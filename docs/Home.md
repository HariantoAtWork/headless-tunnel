# headless-tunnel wiki

Shared **WebSocket reverse-tunnel broker**: a local app registers outbound; remote Chromium (Playwright, Oxider, …) fetches pages through the broker without needing a public URL for that app.

| Page | Topic |
| --- | --- |
| [Architecture](Architecture.md) | Faces, data flow, Tailscale vs public edge |
| [WebSocket protocol](WebSocket-Protocol.md) | Message types and client duties |
| [Deploy](Deploy.md) | Docker, env, dns01-proxy, `PUBLIC_BASE_URL` |
| [With markdown-to-cv](With-markdown-to-cv.md) | Save as PDF / Test PDF wiring |
| [Troubleshooting](Troubleshooting.md) | Common failures |
| [SemVer releases](semver-releases.md) | Version bumps and Docker Hub publish |

## One-sentence mental model

**Chromium speaks HTTP to `/t/:id/…`. The broker turns that into WebSocket `http-request` / `http-response` on a session the laptop opened.**

## Live example (uti.email)

| Role | URL |
| --- | --- |
| Broker / register / fetch edge | https://tunnel.headless.uti.email/ |
| Health | `GET /health` → `{ ok, sessions, publicBaseUrl }` |
| Register | `GET /tunnel` (WebSocket) |
| Fetch | `ANY /t/:tunnelId/*` |

The process itself is **bearer-free**. Gate `/tunnel` with [dns01-proxy](https://github.com/harianto/dns01-stack) when you want registration locked down.
