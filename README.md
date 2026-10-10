# headless-tunnel

Shared **WebSocket tunnel broker** (bearer-free). Local apps register outbound; remote Chromium fetches pages through the broker over Tailscale.

Gate **registration** with [dns01-proxy](https://github.com/harianto/dns01-stack) Access Lists — same pattern as AI servers that have no built-in auth. The tunnel process itself does **not** verify bearer tokens.

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | `{ ok, sessions, publicBaseUrl }` |
| `GET` | `/tunnel` | **WebSocket** register (apps) |
| `*` | `/t/:tunnelId/*` | Reverse HTTP for Chromium / fetchers |

### WebSocket message types (v1)

| `type` | Direction | Role |
| --- | --- | --- |
| `ready` | server → client | `{ tunnelId, baseUrl }` — `baseUrl` is Chromium-facing (`PUBLIC_BASE_URL`) |
| `http-request` | server → client | `{ id, method, path, headers, bodyBase64? }` |
| `http-response` | client → server | `{ id, status, headers, bodyBase64? }` |
| `ping` / `pong` | either | keepalive |

## Auth split (important)

| Face | Who | URL | Auth |
| --- | --- | --- | --- |
| **Register** | Apps | dns01 edge hostname → upstream `/tunnel` | dns01 bearer list; strip `Authorization` before upstream |
| **Fetch** | Chromium | Tailscale MagicsDNS of this service `/t/:id/…` | none — printers cannot present dns01 keys |

`PUBLIC_BASE_URL` must be the **Chromium-facing** origin (e.g. `https://headless-tunnel.catfish-shade.ts.net`), not the dns01-gated register host.

### dns01-proxy setup

1. Add an edge host (e.g. `tunnel-register.example`) → upstream `http://headless-tunnel:9382`.
2. Attach a **bearer list** (mint keys in the dns01-proxy UI / Access Lists — same as other gated apps).
3. Ensure WebSocket upgrade is forwarded.
4. Set **pass auth upstream = false** (strip `Authorization`) so this broker never sees tokens.
5. Point apps at the dns01 register URL for WS; keep Tailscale MagicsDNS of `headless-tunnel` as `PUBLIC_BASE_URL` for PDF printers.

Wrong/missing bearer → **401 at dns01**; the tunnel never sees the connection.

## Run

```bash
cp .env.example .env
cp docker-compose.yml.example docker-compose.yml
cp docker-compose.override.yml.example docker-compose.override.yml   # optional cloudflared
./dc.sh build
docker compose up -d
curl -s http://127.0.0.1:9382/health
```

Multi-arch Hub push: `./dc.sh push` (amd64 + arm64).

Default host port: **9382**.

## Env

| Variable | Default | Meaning |
| --- | --- | --- |
| `TUNNEL_PORT` | `9382` | Listen port |
| `TUNNEL_HOST` | `0.0.0.0` | Bind address |
| `PUBLIC_BASE_URL` | `http://127.0.0.1:9382` | Origin returned in `ready.baseUrl` (Tailscale MagicsDNS in prod) |
| `TUNNEL_IDLE_TTL_MS` | `900000` | Drop idle sessions |
| `TUNNEL_REQUEST_TIMEOUT_MS` | `60000` | Per proxied HTTP request |
| `TUNNEL_MAX_BODY_BYTES` | `8388608` | Max proxied body size |

## Layout

```text
src/headless-tunnel/   # app + Dockerfile + Dockerfile.platform
dc.sh
_build.yml
_push.yml
docker-compose.yml.example
```

Docker images use `oven/bun:canary-alpine`.
