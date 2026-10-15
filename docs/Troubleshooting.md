# Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Test PDF disabled in markdown-to-cv | No print origin and no tunnel register URL | Set register URL (bearer optional) or MagicsDNS print origin |
| WS never gets `ready` | dns01 401, wrong register URL, WS not upgraded | Check bearer / Access List; confirm edge forwards WebSockets |
| `ready.baseUrl` host `ENOTFOUND` from Playwright | `PUBLIC_BASE_URL` is MagicsDNS; printer has no Tailscale DNS | Set `PUBLIC_BASE_URL` (or app public-base override) to a hostname Playwright can resolve |
| PDF waits forever on `data-cv-print-ready` | Print page never rendered / wrong path | Hit `/t/:id/print/…` in a browser; confirm local Nuxt returns 200 |
| HTTP 502 from `/t/:id/…` | Local fetch failed or session closed | Keep WS open until PDF finishes; check local origin port |
| Empty / tiny PDF | Playwright got an error HTML page | `POST /fetch` the same URL; inspect title/body |
| PDF has content but no CSS/fonts | Root-absolute `/_nuxt/…` resolved outside `/t/:id` | Broker/client rewrite (this repo); redeploy tunnel + restart markdown-to-cv |
| Session count stuck | Clients not closing sockets | Rely on idle TTL or close after each job |

## Quick checks

```bash
curl -sS https://tunnel.headless.uti.email/health
curl -sS https://playwright.headless.uti.email/health
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/print/example/demo-editorial.en
```

## Auth reminder

- **Register** may be gated (dns01).
- **Fetch** (`/t/:id`) must stay reachable without a bearer so headless Chromium can load the page.
