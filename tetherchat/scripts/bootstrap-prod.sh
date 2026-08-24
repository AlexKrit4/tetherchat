#!/usr/bin/env bash
# Production bootstrap for tetherchat.ru. Intended to run on the server as root.
set -euo pipefail

ROOT=/opt/tetherchat
COMPOSE=(docker compose -f docker-compose.prod.yml)
cd "$ROOT"
mkdir -p letsencrypt certbot-www

if [[ ! -f .env ]]; then
  echo "missing $ROOT/.env" >&2
  exit 1
fi

echo "==> building and starting stack (HTTP edge)"
NGINX_EDGE_CONF=./nginx/tetherchat.ru.http.conf "${COMPOSE[@]}" up -d --build

echo "==> waiting for API health through the edge"
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1/api/health >/dev/null 2>&1; then
    echo "API is up"
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "API did not become healthy" >&2
    "${COMPOSE[@]}" logs --tail=80 api edge
    exit 1
  fi
  sleep 5
done

echo "==> seeding demo data (idempotent enough for first boot)"
"${COMPOSE[@]}" exec -T api ../../node_modules/.bin/tsx prisma/seed.ts || true

if [[ -f letsencrypt/live/tetherchat.ru/fullchain.pem ]]; then
  echo "==> certificates already present, switching edge to TLS"
else
  echo "==> requesting Let's Encrypt certificates"
  "${COMPOSE[@]}" stop edge
  if "${COMPOSE[@]}" --profile certs run --rm --service-ports certbot \
    certonly --standalone --non-interactive --agree-tos \
    --email admin@tetherchat.ru \
    -d tetherchat.ru -d www.tetherchat.ru; then
    echo "certificates issued"
  else
    echo "certbot failed; keeping HTTP edge" >&2
  fi
fi

if [[ -f letsencrypt/live/tetherchat.ru/fullchain.pem ]]; then
  # Refresh cookie flags for HTTPS now that TLS terminates at the edge.
  sed -i \
    -e 's|^PUBLIC_WEB_ORIGIN=.*|PUBLIC_WEB_ORIGIN=https://tetherchat.ru|' \
    -e 's|^PUBLIC_API_ORIGIN=.*|PUBLIC_API_ORIGIN=https://tetherchat.ru|' \
    -e 's|^COOKIE_SECURE=.*|COOKIE_SECURE=true|' \
    -e 's|^S3_PUBLIC_URL=.*|S3_PUBLIC_URL=https://tetherchat.ru/files|' \
    .env
  if ! grep -q '^COOKIE_DOMAIN=' .env; then
    echo 'COOKIE_DOMAIN=.tetherchat.ru' >> .env
  else
    sed -i 's|^COOKIE_DOMAIN=.*|COOKIE_DOMAIN=.tetherchat.ru|' .env
  fi
  NGINX_EDGE_CONF=./nginx/tetherchat.ru.conf "${COMPOSE[@]}" up -d --force-recreate edge api
else
  NGINX_EDGE_CONF=./nginx/tetherchat.ru.http.conf "${COMPOSE[@]}" up -d edge
fi

echo "==> status"
"${COMPOSE[@]}" ps
curl -fsS http://127.0.0.1/api/health || true
echo
echo "bootstrap done"
