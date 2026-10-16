# SemVer releases (learn by shipping)

How **this** repo publishes to Docker Hub. Same ritual as the other `headless-*` images.

## Why SemVer exists

```text
MAJOR.MINOR.PATCH   →   e.g. 1.0.0
```

| Part | Bump when | Example |
| --- | --- | --- |
| **MAJOR** | Breaking for apps or Chromium already talking to you | Change WS message shape, rename `/tunnel`, change `ready` fields incompatibly |
| **MINOR** | New capability, old clients still work | Extra rewrite behaviour that does not break existing tunnels |
| **PATCH** | Fix or image-only tweak, same protocol | Rewrite bug fix, Alpine base bump |

Think from the client’s point of view (registering apps + Chromium fetchers). Spec: [semver.org](https://semver.org/).

## How *our* pipeline uses SemVer

You choose the version. GitHub Actions does **not**.

```text
git tag v1.0.1  ──push──►  Actions build  ──►  Docker Hub
                                              1.0.1
                                              1.0
                                              latest
```

| You create (git) | Hub gets |
| --- | --- |
| `v1.0.0` | `harianto/headless-tunnel:1.0.0`, `:1.0`, `:latest` |

- Git tag has a leading **`v`**; Hub tags do **not**.
- Pushing `main` alone publishes **nothing**.
- Build context is `src/headless-tunnel` + `Dockerfile.platform` (amd64 + arm64).
- Pin compose to `1.0.0` in production; treat `latest` as lab-only.

Workflow: [`.github/workflows/docker-publish.yml`](../.github/workflows/docker-publish.yml).

## Decide the next version

```bash
git fetch --tags
git tag -l 'v*' | sort -V | tail -5
git log v1.0.0..HEAD --oneline
```

| Since last tag you… | Next tag |
| --- | --- |
| Only fixed bugs / image internals | `v1.0.1` |
| Added compatible behaviour | `v1.1.0` |
| Broke WS/HTTP contract | `v2.0.0` |
| Docs-only (wiki under `docs/`) | **no tag** |

## Release checklist

```bash
git status
git fetch origin && git pull --ff-only origin main
NEXT=v1.0.1
git tag -a "$NEXT" -m "$NEXT"
git push origin "$NEXT"
docker pull harianto/headless-tunnel:1.0.1
```

## Habits

- Tag clean `main`; prefer annotated tags.
- Protocol docs in `docs/WebSocket-Protocol.md` should match what you just versioned.
- Secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`.

## Sibling images

Same SemVer rules: `headless-oxider`, `headless-camoufox`, `headless-obscura`, `headless-playwright`.

## Quick self-test

1. Fix rewrite bug only → `v1.0.1`
2. Compatible new message field (old clients ignore it) → `v1.1.0`
3. Rename `http-request` → `request` → `v2.0.0`
4. Troubleshooting wiki only → no tag
