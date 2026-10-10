# WebSocket protocol (v1)

Register: `GET /tunnel` upgraded to WebSocket.

## Messages

| `type` | Direction | Payload |
| --- | --- | --- |
| `ready` | server → client | `{ tunnelId, baseUrl }` — `baseUrl` is Chromium-facing (`PUBLIC_BASE_URL/t/:id`) |
| `http-request` | server → client | `{ id, method, path, headers?, bodyBase64? }` |
| `http-response` | client → server | `{ id, status, headers, bodyBase64? }` |
| `ping` / `pong` | either | keepalive |

## Client duties

1. Connect to the register URL (optional `Authorization: Bearer …` if dns01 gates the edge).
2. Wait for `ready`; remember `baseUrl` (or override with your own public origin + `/t/${tunnelId}`).
3. On `http-request`, `fetch(localOrigin + path)` and send `http-response` with the same `id`.
4. Answer `ping` with `pong`.
5. Close the socket when the PDF job finishes (idle TTL will also drop abandoned sessions).

## HTTP fetch face

Any method on `/t/:tunnelId/*` is reverse-proxied through the matching session. Path after `/t/:tunnelId` is what the client receives as `path` (should start with `/`).

## Limits (defaults)

| Env | Default | Meaning |
| --- | --- | --- |
| `TUNNEL_IDLE_TTL_MS` | `900000` (15 min) | Drop idle sessions |
| `TUNNEL_REQUEST_TIMEOUT_MS` | `60000` | Per proxied request |
| `TUNNEL_MAX_BODY_BYTES` | `8388608` (8 MiB) | Max proxied body |
