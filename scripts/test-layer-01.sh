#!/usr/bin/env bash

set -u

ROOT="/opt/free-ai"

cd "$ROOT" || {
  echo "[FATAL] Cannot access $ROOT"
  exit 1
}

echo
echo "=========================================="
echo " FREE AI — LAYER 01 TEST SUITE"
echo "=========================================="

echo
echo "========== ENVIRONMENT =========="

printf "Node: "
node --version || true

printf "pnpm: "
pnpm --version 2>/dev/null || echo "NOT AVAILABLE"

printf "Git: "
git --version || true

echo
echo "========== STATIC AUDIT =========="

node scripts/test-layer-01-audit.mjs
AUDIT_STATUS=$?

echo
echo "========== PRISMA VALIDATION =========="

if [ -x "apps/api/node_modules/.bin/prisma" ]; then
  apps/api/node_modules/.bin/prisma validate \
    --schema apps/api/prisma/schema.prisma
  PRISMA_STATUS=$?
elif [ -x "node_modules/.bin/prisma" ]; then
  node_modules/.bin/prisma validate \
    --schema apps/api/prisma/schema.prisma
  PRISMA_STATUS=$?
else
  echo "[SKIP] Prisma CLI غير مثبت. لم يتم تثبيت أي حزم."
  PRISMA_STATUS=2
fi

echo
echo "========== TYPESCRIPT CHECK =========="

if [ -x "node_modules/.bin/tsc" ]; then
  node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
  TS_STATUS=$?
elif [ -x "apps/api/node_modules/.bin/tsc" ]; then
  apps/api/node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
  TS_STATUS=$?
else
  echo "[SKIP] TypeScript compiler غير مثبت."
  TS_STATUS=2
fi

echo
echo "========== GIT WHITESPACE =========="

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git diff --check
  GIT_STATUS=$?
else
  echo "[WARN] المجلد ليس Git repository."
  GIT_STATUS=2
fi

echo
echo "========== FILE INVENTORY =========="

find apps/api/src/infrastructure \
     apps/api/src/modules \
     apps/api/src/middleware \
     apps/api/prisma \
     -type f 2>/dev/null | sort

echo
echo "========== GIT STATUS =========="

git status --short --branch 2>/dev/null || true

echo
echo "=========================================="
echo " TEST RESULT SUMMARY"
echo "=========================================="

printf "Static audit: "
[ "$AUDIT_STATUS" -eq 0 ] && echo "PASS" || echo "FAIL"

printf "Prisma validation: "
[ "$PRISMA_STATUS" -eq 0 ] && echo "PASS" || echo "NOT RUN / FAIL"

printf "TypeScript: "
[ "$TS_STATUS" -eq 0 ] && echo "PASS" || echo "NOT RUN / FAIL"

printf "Git whitespace: "
[ "$GIT_STATUS" -eq 0 ] && echo "PASS" || echo "NOT RUN / FAIL"

if [ "$AUDIT_STATUS" -ne 0 ] || \
   [ "$PRISMA_STATUS" -eq 1 ] || \
   [ "$TS_STATUS" -eq 1 ] || \
   [ "$GIT_STATUS" -eq 1 ]; then
  echo
  echo "OVERALL: FAIL — راجع الأخطاء قبل الانتقال."
  exit 1
fi

echo
echo "OVERALL: STATIC CHECKS COMPLETED."
echo "أي اختبار ظهر NOT RUN لا يعتبر ناجحاً."
