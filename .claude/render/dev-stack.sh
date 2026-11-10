#!/usr/bin/env bash
# Render-review dev stack for Coin Collector Companion. Run by the "render" configuration in
# .claude/launch.json, from the repo root of a throwaway worktree, with env from
# .claude/render/setup.mjs start(): DATABASE_URL (a throwaway Docker Postgres, never Neon),
# JWT_SECRET, NEXT_PUBLIC_API_URL, CCC_RENDER_API_PORT, and PORT from render-capture.
#
# Builds what the API needs, applies migrations to the throwaway database, starts the API in
# the background (same process group, so render-capture's cleanup kills it with the web
# server), waits for /api/v1/health, then runs `next dev` on $PORT in the foreground.
set -euo pipefail

: "${PORT:?PORT is not set}"
: "${CCC_RENDER_API_PORT:?CCC_RENDER_API_PORT is not set (start() of .claude/render/setup.mjs sets it)}"
: "${DATABASE_URL:?DATABASE_URL is not set}"

case "$DATABASE_URL" in
  *@127.0.0.1:*|*@localhost:*) ;;
  *) echo "[render-stack] refusing to run: DATABASE_URL is not a local throwaway database" >&2; exit 1 ;;
esac

echo "[render-stack] shared build"
pnpm --filter @coin-collector/shared build
echo "[render-stack] prisma generate"
pnpm --filter api exec prisma generate
echo "[render-stack] prisma migrate deploy (throwaway database)"
pnpm --filter api exec prisma migrate deploy
echo "[render-stack] api build"
pnpm --filter api build

echo "[render-stack] starting API on :$CCC_RENDER_API_PORT"
(
  cd apps/api
  PORT="$CCC_RENDER_API_PORT" CORS_ORIGIN="http://localhost:$PORT" exec node dist/main
) &

for _ in $(seq 1 120); do
  if curl -sf "http://localhost:$CCC_RENDER_API_PORT/api/v1/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -sf "http://localhost:$CCC_RENDER_API_PORT/api/v1/health" >/dev/null || {
  echo "[render-stack] API did not become healthy within 120s" >&2
  exit 1
}

echo "[render-stack] starting web (next dev) on :$PORT"
cd apps/web
exec pnpm exec next dev --port "$PORT"
