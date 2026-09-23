#!/usr/bin/env bash
# One-time provisioning for a fresh Contabo VPS (Ubuntu 22.04/24.04 assumed).
# Run this ONCE by hand over SSH — everything after this is handled by
# .github/workflows/deploy.yml on every push to main. Re-running it later is
# safe (idempotent) if you need to recover a broken box.
#
# Usage: ssh onto the VPS as a sudo-capable user, then:
#   curl -fsSL https://raw.githubusercontent.com/<you>/KamerFoodLens_back/main/scripts/vps-setup.sh -o vps-setup.sh
#   chmod +x vps-setup.sh && ./vps-setup.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/kfl}"

echo "==> Installing Docker Engine + Compose plugin"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$(whoami)" || true
fi

echo "==> Creating deploy directory at $DEPLOY_PATH"
mkdir -p "$DEPLOY_PATH/nginx/certs"
cd "$DEPLOY_PATH"

echo "==> Fetching docker-compose.prod.yml and nginx.conf from GitHub"
read -rp "GitHub repo (owner/name, e.g. techainova/KamerFoodLens_back): " REPO
read -rp "Branch [main]: " BRANCH
BRANCH="${BRANCH:-main}"
curl -fsSL "https://raw.githubusercontent.com/${REPO}/${BRANCH}/docker-compose.prod.yml" -o docker-compose.prod.yml
curl -fsSL "https://raw.githubusercontent.com/${REPO}/${BRANCH}/nginx/nginx.conf" -o nginx/nginx.conf

if [ ! -f .env ]; then
  echo "==> No .env found — creating one now. Paste real production values, not the .env.example placeholders."
  cat <<'EOF' > .env
# Filled in interactively by vps-setup.sh — edit freely afterwards with:
#   nano /opt/kfl/.env
# then: docker compose -f docker-compose.prod.yml up -d --no-deps api

PORT=3000
NODE_ENV=production

POSTGRES_USER=kfl
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=kfl
DATABASE_URL=postgresql://kfl:CHANGE_ME@postgres:5432/kfl

MONGODB_URI=mongodb://mongodb:27017/kfl

REDIS_PASSWORD=CHANGE_ME
REDIS_URL=redis://:CHANGE_ME@redis:6379

JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_REFRESH_SECRET=CHANGE_ME
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ENCRYPTION_KEY=CHANGE_ME_32_BYTE_HEX

AI_SERVICE_URL=http://ai-service:8000
AI_SERVICE_IMAGE=

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=CHANGE_ME
SMTP_PASS=CHANGE_ME
SMTP_FROM="KmerFoodLens <noreply@kmerfooodlens.com>"

CINETPAY_API_KEY=CHANGE_ME
CINETPAY_SITE_ID=CHANGE_ME

STRIPE_SECRET_KEY=CHANGE_ME
STRIPE_WEBHOOK_SECRET=CHANGE_ME

MINIO_ROOT_USER=CHANGE_ME
MINIO_ROOT_PASSWORD=CHANGE_ME
AWS_ENDPOINT=http://minio:9000
AWS_ACCESS_KEY_ID=CHANGE_ME
AWS_SECRET_ACCESS_KEY=CHANGE_ME
AWS_S3_BUCKET=kfl-media
AWS_REGION=eu-west-3

ALLOWED_ORIGINS=https://app.kmerfooodlens.com

FCM_SERVER_KEY=CHANGE_ME

GOOGLE_CLIENT_ID=CHANGE_ME
GOOGLE_CLIENT_SECRET=CHANGE_ME
GOOGLE_CALLBACK_URL=https://your-domain.example.com/auth/google/callback
GOOGLE_WEB_CLIENT_ID=CHANGE_ME
GOOGLE_ANDROID_CLIENT_ID=CHANGE_ME
GOOGLE_IOS_CLIENT_ID=CHANGE_ME

DOCKERHUB_USERNAME=CHANGE_ME
EOF
  echo "    -> Wrote a template .env to $DEPLOY_PATH/.env — edit it now before continuing:"
  echo "       nano $DEPLOY_PATH/.env"
  echo "    Re-run this script after editing, or just run the docker compose commands below by hand."
  exit 0
fi

echo "==> Logging into DockerHub (needed once so 'docker compose pull' works for a private image)"
docker login

echo "==> Pulling images and starting the stack"
docker compose -f docker-compose.prod.yml --env-file .env up -d

echo "==> Running Prisma migrations against the fresh database"
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy

echo "==> Done. Check status with: docker compose -f docker-compose.prod.yml ps"
echo "    Logs:                    docker compose -f docker-compose.prod.yml logs -f api"
