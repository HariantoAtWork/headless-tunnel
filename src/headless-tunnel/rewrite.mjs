/**
 * Prefix root-absolute *URL* paths with `/t/:tunnelId` so Chromium
 * subresources stay inside the tunnel session.
 *
 * Do not rewrite bare ` / ` in prose or CSS (`1.1rem/1.2`, `rgb(… / …)`).
 */

const TEXTISH =
  /^(text\/|application\/(javascript|json|xml|xhtml|ecmascript)|.*\+xml)/i

export function isRewritableContentType(contentType) {
  if (!contentType) return false
  const mime = String(contentType).split(';')[0].trim()
  return TEXTISH.test(mime)
}

export function rewriteAbsolutePaths(text, tunnelId) {
  const id = String(tunnelId || '').trim()
  if (!id || !text) return text
  const prefix = `/t/${id}`
  const base = `${prefix}/`

  let out = text
  out = out.replace(/(\bbaseURL\s*:\s*")\/(")/g, `$1${base}$2`)
  out = out.replace(/("baseURL"\s*:\s*")\/(")/g, `$1${base}$2`)
  out = out.replace(
    /\b((?:href|src|action|poster|data-src|cite)\s*=\s*["'])\/(?!\/|t\/)/gi,
    `$1${prefix}/`,
  )
  out = out.replace(/(url\(\s*["']?)\/(?!\/|t\/)/gi, `$1${prefix}/`)
  out = out.replace(/(@import\s+["'])\/(?!\/|t\/)/g, `$1${prefix}/`)
  out = out.replace(/\b(import\s*\(\s*["'])\/(?!\/|t\/)/g, `$1${prefix}/`)
  out = out.replace(/\b(from\s+["'])\/(?!\/|t\/)/g, `$1${prefix}/`)
  out = out.replace(/(["'])\/(_nuxt\/)/g, `$1${prefix}/$2`)
  out = out.replace(/(["'])\/(api\/)/g, `$1${prefix}/$2`)
  return out
}

export function rewriteLocationHeader(value, tunnelId) {
  if (value == null) return value
  const id = String(tunnelId || '').trim()
  if (!id) return value
  const v = String(value).trim()
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith(`/t/${id}`)) {
    return value
  }
  return `/t/${id}${v}`
}

/**
 * @param {Buffer} body
 * @param {Record<string, string>} headers
 * @param {string} tunnelId
 * @returns {{ body: Buffer, headers: Record<string, string> }}
 */
export function rewriteTunnelHttpResult(body, headers, tunnelId) {
  const outHeaders = { ...(headers || {}) }
  const locKey = Object.keys(outHeaders).find((k) => k.toLowerCase() === 'location')
  if (locKey) {
    outHeaders[locKey] = rewriteLocationHeader(outHeaders[locKey], tunnelId)
  }

  const ctKey = Object.keys(outHeaders).find(
    (k) => k.toLowerCase() === 'content-type',
  )
  const contentType = ctKey ? outHeaders[ctKey] : ''
  let nextBody = Buffer.isBuffer(body) ? body : Buffer.from(body || [])
  if (isRewritableContentType(contentType) && nextBody.length) {
    const text = nextBody.toString('utf8')
    const rewritten = rewriteAbsolutePaths(text, tunnelId)
    if (rewritten !== text) {
      nextBody = Buffer.from(rewritten, 'utf8')
    }
  }

  const clKey = Object.keys(outHeaders).find(
    (k) => k.toLowerCase() === 'content-length',
  )
  if (clKey) outHeaders[clKey] = String(nextBody.length)
  else outHeaders['content-length'] = String(nextBody.length)

  return { body: nextBody, headers: outHeaders }
}
