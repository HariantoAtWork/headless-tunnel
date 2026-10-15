#!/usr/bin/env bun
/**
 * Shared WebSocket tunnel broker (bearer-free).
 *
 * Gate app registration with dns01-proxy Access Lists.
 * Chromium fetches PUBLIC_BASE_URL /t/:id/… over Tailscale (no bearer).
 *
 * GET  /health  → { ok, sessions }
 * GET  /tunnel  → WebSocket upgrade (register)
 * *    /t/:id/* → reverse HTTP via the registered WS client
 */

import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocketServer } from 'ws'
import { rewriteTunnelHttpResult } from './rewrite.mjs'

const PORT = Number(process.env.TUNNEL_PORT || process.env.PORT || 9382)
const HOST = process.env.TUNNEL_HOST || '0.0.0.0'
const PUBLIC_BASE_URL = String(
  process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${PORT}`,
)
  .trim()
  .replace(/\/$/, '')
const IDLE_TTL_MS = Number(process.env.TUNNEL_IDLE_TTL_MS || 15 * 60_000)
const REQUEST_TIMEOUT_MS = Number(process.env.TUNNEL_REQUEST_TIMEOUT_MS || 60_000)
const MAX_BODY_BYTES = Number(process.env.TUNNEL_MAX_BODY_BYTES || 8 * 1024 * 1024)

/** @typedef {{
 *   id: string
 *   ws: import('ws').WebSocket
 *   createdAt: number
 *   lastActiveAt: number
 *   pending: Map<string, { resolve: (v: any) => void, reject: (e: Error) => void, timer: NodeJS.Timeout }>
 * }} TunnelSession */

/** @type {Map<string, TunnelSession>} */
const sessions = new Map()

function now() {
  return Date.now()
}

function publicBaseFor(tunnelId) {
  return `${PUBLIC_BASE_URL}/t/${tunnelId}`
}

function touch(session) {
  session.lastActiveAt = now()
}

function destroySession(tunnelId, reason = 'closed') {
  const session = sessions.get(tunnelId)
  if (!session) return
  sessions.delete(tunnelId)
  for (const [, pending] of session.pending) {
    clearTimeout(pending.timer)
    pending.reject(new Error(`tunnel ${tunnelId} ${reason}`))
  }
  session.pending.clear()
  try {
    if (session.ws.readyState === session.ws.OPEN) session.ws.close()
  } catch {
    /* ignore */
  }
  console.log(`[tunnel] session ${tunnelId} destroyed (${reason})`)
}

function sendJson(ws, payload) {
  if (ws.readyState !== ws.OPEN) return
  ws.send(JSON.stringify(payload))
}

/**
 * @param {TunnelSession} session
 * @param {object} req
 * @returns {Promise<{ status: number, headers: Record<string, string>, body: Buffer }>}
 */
function proxyViaWs(session, req) {
  const id = randomUUID()
  touch(session)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      session.pending.delete(id)
      reject(new Error(`tunnel request timed out after ${REQUEST_TIMEOUT_MS}ms`))
    }, REQUEST_TIMEOUT_MS)
    session.pending.set(id, { resolve, reject, timer })
    sendJson(session.ws, {
      type: 'http-request',
      id,
      method: req.method,
      path: req.path,
      headers: req.headers,
      bodyBase64: req.bodyBase64 || undefined,
    })
  })
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error(`request body exceeds ${limit} bytes`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendHttpJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function parseTunnelPath(urlPath) {
  // /t/<id>/rest...  or /t/<id>
  const m = urlPath.match(/^\/t\/([^/]+)(\/.*)?$/)
  if (!m) return null
  const tunnelId = m[1]
  const rest = m[2] || '/'
  return { tunnelId, path: rest }
}

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `${HOST}:${PORT}`
  let url
  try {
    url = new URL(req.url || '/', `http://${host}`)
  } catch {
    sendHttpJson(res, 400, { ok: false, error: 'bad url' })
    return
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    sendHttpJson(res, 200, {
      ok: true,
      browser: 'tunnel',
      sessions: sessions.size,
      publicBaseUrl: PUBLIC_BASE_URL,
    })
    return
  }

  if (req.method === 'GET' && url.pathname === '/') {
    sendHttpJson(res, 200, {
      ok: true,
      service: 'headless-tunnel',
      endpoints: {
        health: 'GET /health',
        tunnel: 'GET /tunnel (WebSocket)',
        fetch: 'ANY /t/:tunnelId/*',
      },
      note: 'Bearer-free broker. Gate /tunnel with dns01-proxy; Chromium uses PUBLIC_BASE_URL /t/:id over Tailscale.',
    })
    return
  }

  if (url.pathname === '/tunnel') {
    sendHttpJson(res, 426, {
      ok: false,
      error: 'Upgrade required — connect with WebSocket to /tunnel',
    })
    return
  }

  const parsed = parseTunnelPath(url.pathname)
  if (!parsed) {
    sendHttpJson(res, 404, { ok: false, error: 'not found' })
    return
  }

  const session = sessions.get(parsed.tunnelId)
  if (!session) {
    sendHttpJson(res, 404, { ok: false, error: 'unknown or expired tunnel' })
    return
  }

  try {
    const bodyBuf = await readBody(req, MAX_BODY_BYTES)
    const hopHeaders = { ...req.headers }
    delete hopHeaders.host
    delete hopHeaders.connection
    delete hopHeaders['content-length']
    delete hopHeaders['transfer-encoding']

    const pathWithQuery = parsed.path + (url.search || '')
    const result = await proxyViaWs(session, {
      method: req.method || 'GET',
      path: pathWithQuery,
      headers: hopHeaders,
      bodyBase64: bodyBuf.length ? bodyBuf.toString('base64') : undefined,
    })

    const rawHeaders = { ...(result.headers || {}) }
    delete rawHeaders['transfer-encoding']
    delete rawHeaders.connection
    const rawBody = Buffer.isBuffer(result.body)
      ? result.body
      : Buffer.from(result.body || [])
    const { body, headers: outHeaders } = rewriteTunnelHttpResult(
      rawBody,
      rawHeaders,
      parsed.tunnelId,
    )
    res.writeHead(result.status || 502, outHeaders)
    res.end(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    sendHttpJson(res, 502, { ok: false, error: message })
  }
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  let url
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  } catch {
    socket.destroy()
    return
  }
  if (url.pathname !== '/tunnel') {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})

wss.on('connection', (ws) => {
  const tunnelId = randomUUID()
  /** @type {TunnelSession} */
  const session = {
    id: tunnelId,
    ws,
    createdAt: now(),
    lastActiveAt: now(),
    pending: new Map(),
  }
  sessions.set(tunnelId, session)
  console.log(`[tunnel] session ${tunnelId} registered`)

  sendJson(ws, {
    type: 'ready',
    tunnelId,
    baseUrl: publicBaseFor(tunnelId),
  })

  ws.on('message', (data, isBinary) => {
    touch(session)
    if (isBinary) return
    let msg
    try {
      msg = JSON.parse(String(data))
    } catch {
      return
    }
    if (!msg || typeof msg !== 'object') return

    if (msg.type === 'pong') return
    if (msg.type === 'ping') {
      sendJson(ws, { type: 'pong' })
      return
    }
    if (msg.type === 'http-response') {
      const pending = session.pending.get(String(msg.id || ''))
      if (!pending) return
      session.pending.delete(String(msg.id))
      clearTimeout(pending.timer)
      const body = msg.bodyBase64
        ? Buffer.from(String(msg.bodyBase64), 'base64')
        : Buffer.alloc(0)
      pending.resolve({
        status: Number(msg.status) || 502,
        headers:
          msg.headers && typeof msg.headers === 'object' ? msg.headers : {},
        body,
      })
    }
  })

  ws.on('close', () => destroySession(tunnelId, 'ws-close'))
  ws.on('error', () => destroySession(tunnelId, 'ws-error'))
})

setInterval(() => {
  const cutoff = now() - IDLE_TTL_MS
  for (const [id, session] of sessions) {
    if (session.lastActiveAt < cutoff) destroySession(id, 'idle-timeout')
  }
  for (const session of sessions.values()) {
    sendJson(session.ws, { type: 'ping' })
  }
}, Math.min(60_000, Math.max(10_000, Math.floor(IDLE_TTL_MS / 3))))

server.listen(PORT, HOST, () => {
  console.log(
    `[headless-tunnel] listening on http://${HOST}:${PORT} publicBaseUrl=${PUBLIC_BASE_URL}`,
  )
})
