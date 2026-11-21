#!/usr/bin/env bash
set -euo pipefail

echo "===== FREE AI PREFLIGHT ====="

if [[ "$EUID" -ne 0 ]]; then
  echo "ERROR: Run as root."
  exit 1
fi

echo "===== PROJECT ====="
test -d /opt/free-ai
cd /opt/free-ai
pwd

echo "===== SYSTEM ====="
cat /etc/os-release | head -n 5
uname -r

echo "===== NODE ====="
node --version
npm --version
pnpm --version

echo "===== PYTHON ====="
python3 --version
.venv/bin/python --version

echo "===== GIT ====="
git --version
git status --short --branch

echo "===== DOCKER ====="
docker --version
docker info >/dev/null
echo "Docker daemon: READY"

echo "===== COMPOSE ====="
if docker compose version >/dev/null 2>&1; then
  docker compose version
elif docker-compose version >/dev/null 2>&1; then
  docker-compose version
else
  echo "ERROR: Docker Compose is unavailable."
  exit 1
fi

echo "===== STORAGE ====="
df -h /opt/free-ai

echo "===== MEMORY ====="
free -h

echo "===== PROJECT DIRECTORIES ====="
find /opt/free-ai -maxdepth 2 -type d | sort

echo "===== PREFLIGHT RESULT ====="
echo "BASE ENVIRONMENT CHECK PASSED"
