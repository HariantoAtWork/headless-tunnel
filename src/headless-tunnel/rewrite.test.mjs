import { describe, expect, test } from 'bun:test'
import {
  rewriteAbsolutePaths,
  rewriteLocationHeader,
  rewriteTunnelHttpResult,
} from './rewrite.mjs'

describe('rewriteAbsolutePaths', () => {
  test('prefixes URL contexts without double-prefix or breaking externals', () => {
    const html = [
      'href="/_nuxt/a.css"',
      'import("/_nuxt/b.js")',
      'url(/fonts/x.woff2)',
      'href="https://fonts.googleapis.com/x"',
      'src="//cdn.example/a.png"',
      'href="/t/abc/_nuxt/keep.css"',
    ].join('\n')
    const out = rewriteAbsolutePaths(html, 'abc')
    expect(out).toContain('href="/t/abc/_nuxt/a.css"')
    expect(out).toContain('import("/t/abc/_nuxt/b.js")')
    expect(out).toContain('url(/t/abc/fonts/x.woff2)')
    expect(out).toContain('https://fonts.googleapis.com/x')
    expect(out).toContain('src="//cdn.example/a.png"')
    expect(out).toContain('href="/t/abc/_nuxt/keep.css"')
    expect(out).not.toContain('/t/abc/t/abc/')
  })

  test('leaves CSS slash syntax and prose alone', () => {
    const css = [
      'font: 600 1.1rem/1.35 serif;',
      'color: rgb(18 16 14 / 5%);',
      'content: "Rijswijk / Den Haag";',
    ].join('\n')
    expect(rewriteAbsolutePaths(css, 'abc')).toBe(css)
  })
})

describe('rewriteTunnelHttpResult', () => {
  test('rewrites body + location and updates content-length', () => {
    const { body, headers } = rewriteTunnelHttpResult(
      Buffer.from('<link href="/_nuxt/x.css">', 'utf8'),
      {
        'content-type': 'text/html',
        location: '/print/a',
        'content-length': '999',
      },
      'z1',
    )
    expect(body.toString('utf8')).toContain('href="/t/z1/_nuxt/x.css"')
    expect(headers.location).toBe('/t/z1/print/a')
    expect(headers['content-length']).toBe(String(body.length))
  })
})

describe('rewriteLocationHeader', () => {
  test('leaves absolute URLs alone', () => {
    expect(rewriteLocationHeader('https://ex.com/a', 'x')).toBe('https://ex.com/a')
  })
})
