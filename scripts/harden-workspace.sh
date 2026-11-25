#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/opt/free-ai"
cd "$ROOT"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: Run this script from the existing root shell."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".prelaunch-backups/workspace-hardening-$STAMP"
mkdir -p "$BACKUP"

write_file() {
  local path="$1"
  mkdir -p "$(dirname "$path")"

  if [[ -f "$path" ]]; then
    mkdir -p "$BACKUP/$(dirname "$path")"
    cp -a "$path" "$BACKUP/$path"
  fi

  cat > "$path"
  echo "CREATED/UPDATED: $path"
}

# --------------------------------------------------
# 1. Workspace definition
# --------------------------------------------------

write_file pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
EOF

# --------------------------------------------------
# 2. Root package
# --------------------------------------------------

write_file package.json <<'EOF'
{
  "name": "free-ai-platform",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "check": "pnpm check:structure && pnpm check:architecture",
    "check:structure": "node scripts/check-structure.mjs",
    "check:architecture": "node scripts/check-architecture.mjs",
    "check:contracts": "node scripts/check-contracts.mjs"
  }
}
EOF

# --------------------------------------------------
# 3. Package manifests
# --------------------------------------------------

write_file packages/contracts/package.json <<'EOF'
{
  "name": "@free-ai/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
EOF

write_file packages/shared/package.json <<'EOF'
{
  "name": "@free-ai/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@free-ai/contracts": "workspace:*"
  }
}
EOF

write_file packages/config/package.json <<'EOF'
{
  "name": "@free-ai/config",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
EOF

write_file apps/api/package.json <<'EOF'
{
  "name": "@free-ai/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "@free-ai/contracts": "workspace:*",
    "@free-ai/shared": "workspace:*",
    "@free-ai/config": "workspace:*"
  }
}
EOF

write_file apps/web/package.json <<'EOF'
{
  "name": "@free-ai/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@free-ai/contracts": "workspace:*",
    "@free-ai/shared": "workspace:*"
  }
}
EOF

write_file services/ai-runtime/package.json <<'EOF'
{
  "name": "@free-ai/ai-runtime",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@free-ai/contracts": "workspace:*",
    "@free-ai/shared": "workspace:*"
  }
}
EOF

# --------------------------------------------------
# 4. TypeScript configuration
# --------------------------------------------------

write_file tsconfig.base.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  }
}
EOF

write_file apps/api/tsconfig.json <<'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
EOF

# --------------------------------------------------
# 5. Structure validator
# --------------------------------------------------

write_file scripts/check-structure.mjs <<'EOF'
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const required = [
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  "apps/api/package.json",
  "apps/api/tsconfig.json",
  "apps/web/package.json",
  "packages/contracts/package.json",
  "packages/shared/package.json",
  "packages/config/package.json",
  "services/ai-runtime/package.json",
  "packages/contracts/src/index.ts",
  "packages/shared/src/index.ts",
  "packages/config/src/index.ts",
  "services/ai-runtime/src/provider-neutral.ts",
  "apps/api/src/main.ts",
  "scripts/check-architecture.mjs",
  "scripts/check-contracts.mjs"
];

const errors = [];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) {
    errors.push(`Missing required file: ${file}`);
  }
}

const manifests = [
  "apps/api/package.json",
  "apps/web/package.json",
  "packages/contracts/package.json",
  "packages/shared/package.json",
  "packages/config/package.json",
  "services/ai-runtime/package.json"
];

const names = new Set();

for (const file of manifests) {
  const fullPath = path.join(root, file);

  if (!fs.existsSync(fullPath)) continue;

  try {
    const pkg = JSON.parse(fs.readFileSync(fullPath, "utf8"));

    if (!pkg.name) errors.push(`${file}: missing package name`);
    if (!pkg.version) errors.push(`${file}: missing version`);

    if (pkg.name && names.has(pkg.name)) {
      errors.push(`${file}: duplicate package name ${pkg.name}`);
    }

    if (pkg.name) names.add(pkg.name);

    for (const [dependency, version] of Object.entries(
      pkg.dependencies ?? {}
    )) {
      if (
        dependency.startsWith("@free-ai/") &&
        version !== "workspace:*"
      ) {
        errors.push(
          `${file}: internal dependency ${dependency} must use workspace:*`
        );
      }
    }
  } catch {
    errors.push(`${file}: invalid JSON`);
  }
}

if (errors.length) {
  console.error("\nSTRUCTURE VALIDATION FAILED\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("STRUCTURE VALIDATION PASSED");
console.log(`Validated ${required.length} required paths.`);
console.log(`Validated ${manifests.length} package manifests.`);
EOF

# --------------------------------------------------
# 6. Architecture validator
# --------------------------------------------------

write_file scripts/check-architecture.mjs <<'EOF'
import fs from "node:fs";

const files = [
  "docs/17-architecture/module-boundaries.md",
  "docs/20-security/authorization-model.md",
  "tests/architecture/architecture-rules.md"
];

const missing = files.filter((file) => !fs.existsSync(file));

if (missing.length) {
  console.error("ARCHITECTURE CHECK FAILED");
  missing.forEach((file) => console.error(`Missing: ${file}`));
  process.exit(1);
}

console.log("ARCHITECTURE DOCUMENT PRESENCE CHECK PASSED");
EOF

# --------------------------------------------------
# 7. Contract validator
# --------------------------------------------------

write_file scripts/check-contracts.mjs <<'EOF'
import fs from "node:fs";

const file = "packages/contracts/src/index.ts";

if (!fs.existsSync(file)) {
  console.error("CONTRACT CHECK FAILED: contracts entry point missing");
  process.exit(1);
}

const content = fs.readFileSync(file, "utf8");

if (!content.trim()) {
  console.error("CONTRACT CHECK FAILED: contracts entry point is empty");
  process.exit(1);
}

console.log("CONTRACT ENTRY POINT CHECK PASSED");
EOF

# --------------------------------------------------
# 8. Workspace rules
# --------------------------------------------------

write_file tests/architecture/workspace-rules.md <<'EOF'
# Workspace Rules

1. Every workspace package has a unique package name.
2. Internal dependencies use workspace:*.
3. Shared contracts must not depend on application packages.
4. Shared utilities must not contain business-specific workflows.
5. Applications may depend on packages, not the reverse.
6. AI Runtime communicates with providers only through the unified gateway.
7. No package may bypass authorization or project isolation.
8. No untrusted code may execute on the host.
9. Secrets must never be committed to Git.
10. Architecture changes require an ADR.
EOF

# --------------------------------------------------
# 9. Documentation
# --------------------------------------------------

write_file docs/15-prelaunch/WORKSPACE-HARDENING.md <<'EOF'
# Workspace Hardening

Status: Prepared for local validation.

This step establishes:
- Explicit pnpm workspace membership.
- Package manifests.
- Internal workspace dependency declarations.
- Shared TypeScript compiler defaults.
- Structure, architecture-document, and contract-entry checks.

This step does not:
- Install dependencies.
- Start application services.
- Select or connect AI providers.
- Download models.
- Claim production readiness.

Validation commands:

    node scripts/check-structure.mjs
    node scripts/check-architecture.mjs
    node scripts/check-contracts.mjs
    git diff --check
EOF

# --------------------------------------------------
# 10. Final validation
# --------------------------------------------------

echo
echo "========== STRUCTURE CHECK =========="
node scripts/check-structure.mjs

echo
echo "========== ARCHITECTURE CHECK =========="
node scripts/check-architecture.mjs

echo
echo "========== CONTRACT CHECK =========="
node scripts/check-contracts.mjs

echo
echo "========== GIT WHITESPACE CHECK =========="
git diff --check

echo
echo "WORKSPACE HARDENING COMPLETED"
echo "Backup: $BACKUP"
