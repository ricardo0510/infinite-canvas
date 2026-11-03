#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE="$ROOT/server/docker-compose.yml"

if ! curl -fsS http://127.0.0.1:8081/v1/models >/dev/null; then
  echo "local-gateway 未启动，请先运行：node tools/local-gateway/server.mjs" >&2
  exit 1
fi

echo "==> 写入本地 Provider / Model"
docker compose -f "$COMPOSE" exec -T postgres psql -U canvas -d canvas \
  < "$ROOT/tools/local-gateway/providers.sql"

echo "==> 绑定本地假 Key（已存在会忽略）"
for provider in local-image local-video local-audio; do
  curl -sS -X POST "http://127.0.0.1:8790/v1/providers/${provider}/credentials" \
    -H 'Content-Type: application/json' \
    -d '{"label":"默认","apiKey":"local"}'
  echo
done

echo "==> 当前可用模型"
curl -sS http://127.0.0.1:8790/v1/models
echo
