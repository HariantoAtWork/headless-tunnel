# Using headless-tunnel with markdown-to-cv

markdown-to-cv Save as PDF / Test PDF can use the tunnel when **Print origin** is empty.

## Settings (`/system/browsers`)

| Field | Example |
| --- | --- |
| Playwright (or Oxider) base URL | `https://playwright.headless.uti.email` |
| Print origin | *(leave empty to use tunnel)* |
| Tunnel register URL | `https://tunnel.headless.uti.email` |
| dns01 bearer | optional — only if the register edge requires it |
| Chromium public base override | `https://tunnel.headless.uti.email` if MagicsDNS in `ready.baseUrl` is unreachable from Playwright |

## What the app does

1. Opens WSS to register URL (`/tunnel`).
2. Receives `ready.baseUrl` (or applies the public-base override).
3. Calls the PDF provider with `url = baseUrl + "/print/…"`.
4. Answers `http-request` by fetching local Nuxt (`http://127.0.0.1:3000` is fine).
5. Closes the tunnel when the PDF buffer is returned.

## Dev note (Vite)

If Playwright loads the print page through a hostname like `host.docker.internal`, Vite must not block Host headers. In markdown-to-cv, `vite.server.allowedHosts: true` covers that for local Docker printers. The tunnel path usually avoids that issue because Chromium hits the **broker**, not Vite’s Host check on the laptop.
