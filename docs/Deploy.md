# Deploy

## Quick start (Docker)

```bash
cp .env.example .env
cp docker-compose.yml.example docker-compose.yml
cp docker-compose.override.yml.example docker-compose.override.yml   # optional cloudflared
./dc.sh build
docker compose up -d
curl -s http://127.0.0.1:9382/health
```

Default host port: **9382**. Multi-arch Hub push: `./dc.sh push`.

## Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `TUNNEL_PORT` | `9382` | Listen port |
| `TUNNEL_HOST` | `0.0.0.0` | Bind address |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:9382` | Origin embedded in `ready.baseUrl` |
| `TUNNEL_IDLE_TTL_MS` | `900000` | Idle session TTL |
| `TUNNEL_REQUEST_TIMEOUT_MS` | `60000` | Per-request timeout |
| `TUNNEL_MAX_BODY_BYTES` | `8388608` | Max body size |

### Choosing `PUBLIC_BASE_URL`

Remote Chromium must be able to open this origin:

- **Tailscale MagicsDNS** of the tunnel container/host (classic private path).
- **Public edge** that terminates TLS and proxies to the broker (e.g. `https://tunnel.headless.uti.email`) when MagicsDNS is not available to the printer.

Do **not** put a dns01-only hostname here if Chromium cannot present a bearer — fetch must stay open.

## dns01-proxy (optional register gate)

1. Edge host → upstream `http://headless-tunnel:9382`.
2. Attach a **bearer Access List**.
3. Forward WebSocket upgrades.
4. **Pass auth upstream = false** (strip `Authorization`).
5. Apps use the dns01 register URL for WSS; keep `PUBLIC_BASE_URL` as the Chromium-facing origin.

Wrong/missing bearer → **401 at dns01**; the tunnel process never sees the connection.

## Health

```bash
curl -s https://tunnel.example/health
# { "ok": true, "browser": "tunnel", "sessions": N, "publicBaseUrl": "…" }
```
