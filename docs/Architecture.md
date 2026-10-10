# Architecture

## Two faces

| Face | Who | Typical URL | Auth |
| --- | --- | --- | --- |
| **Register** | Local apps (markdown-to-cv, …) | dns01 edge → upstream `/tunnel`, or public edge `/tunnel` | Optional dns01 bearer (stripped before upstream) |
| **Fetch** | Remote Chromium | `PUBLIC_BASE_URL/t/:tunnelId/…` | None — printers cannot present dns01 keys |

`PUBLIC_BASE_URL` must be an origin **Chromium can resolve and open**. That is often Tailscale MagicsDNS of the tunnel service. It can also be the same public hostname as the register edge (e.g. `https://tunnel.headless.uti.email`) when that host proxies `/t/…` as well.

## Sequence

```text
Local app ──WSS /tunnel──► headless-tunnel broker
    │                         ▲
    │   http-request /        │
    │   http-response         │ HTTP GET /t/:id/print/…
    │                         │
    ▼                         │
localhost:3000/print     remote Playwright
```

1. App opens WebSocket to register URL (`wss://…/tunnel`).
2. Broker sends `{ type: "ready", tunnelId, baseUrl }`.
3. App asks Playwright `POST /pdf` with `url = baseUrl + "/print/…"`.
4. Playwright HTTP-GETs that URL on the broker.
5. Broker emits `http-request` on the WebSocket; app fetches localhost and replies `http-response`.
6. Broker returns the HTTP response to Playwright → PDF.

## What stays private

- The CV app can remain on `127.0.0.1`.
- Only the outbound WebSocket and the broker’s public `/t/:id` face are exposed.
- Cookies can be forwarded by the app client when proxying private print pages.
