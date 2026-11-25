#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-$ROOT/release-artifacts}"
OUTPUT_DIR="$(mkdir -p "$OUTPUT_DIR" && cd "$OUTPUT_DIR" && pwd)"
VERSION="${RELEASE_VERSION:-$(node -p "require('$ROOT/package.json').version") }"
VERSION="${VERSION// /}"
ARCHIVE="$OUTPUT_DIR/free-ai-platform-$VERSION.tar.gz"
CHECKSUM="$ARCHIVE.sha256"

command -v tar >/dev/null || { echo "TAR_REQUIRED" >&2; exit 2; }
command -v gzip >/dev/null || { echo "GZIP_REQUIRED" >&2; exit 2; }
[[ -f "$ROOT/pnpm-lock.yaml" && -f "$ROOT/scripts/install-local.sh" ]] || { echo "SOURCE_PACKAGE_INPUTS_MISSING" >&2; exit 2; }
[[ ! -e "$ARCHIVE" && ! -e "$CHECKSUM" ]] || { echo "REFUSING_TO_OVERWRITE_RELEASE_ARTIFACT" >&2; exit 2; }

TEMP_TAR="$(mktemp "$OUTPUT_DIR/.free-ai-package.XXXXXX.tar")"
TEMP_GZ="$(mktemp "$OUTPUT_DIR/.free-ai-package.XXXXXX.gz")"
TEMP_SUM="$(mktemp "$OUTPUT_DIR/.free-ai-package.XXXXXX.sha256")"
cleanup() { rm -f -- "$TEMP_TAR" "$TEMP_GZ" "$TEMP_SUM"; }
trap cleanup EXIT

tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner \
  --exclude='.git' --exclude='node_modules' --exclude='.venv' --exclude='venv' \
  --exclude='.prelaunch-backups' --exclude='.repair-backups' --exclude='release-artifacts' \
  --exclude='coverage' --exclude='.turbo' --exclude='dist' --exclude='build' --exclude='*.log' --exclude='*.dump' \
  --exclude='*.pem' --exclude='*.key' --exclude='*.p12' --exclude='*.pfx' --exclude='*.crt' \
  --exclude='.env' --exclude='.env.*' --exclude='**/.env' --exclude='**/.env.*' \
  --exclude='models' --exclude='checkpoints' --exclude='*.safetensors' --exclude='*.gguf' \
  -C "$ROOT" -cf "$TEMP_TAR" \
  README.md package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json vitest.config.ts \
  .npmrc .env.example apps packages services infra scripts tests docs
gzip -n -9 -c "$TEMP_TAR" > "$TEMP_GZ"
mv -- "$TEMP_GZ" "$ARCHIVE"
(cd "$OUTPUT_DIR" && sha256sum "$(basename "$ARCHIVE")") > "$TEMP_SUM"
mv -- "$TEMP_SUM" "$CHECKSUM"
chmod 0644 "$ARCHIVE" "$CHECKSUM"
echo "SOURCE_PACKAGE=$ARCHIVE"
echo "SHA256_FILE=$CHECKSUM"
echo "PACKAGE_VERSION=$VERSION"
