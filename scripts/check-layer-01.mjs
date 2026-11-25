import fs from "node:fs";
import path from "node:path";

const required = [
  "packages/contracts/src/identity/index.ts",
  "packages/contracts/src/authentication/index.ts",
  "packages/contracts/src/authorization/index.ts",
  "packages/contracts/src/projects/index.ts",
  "packages/contracts/src/settings/index.ts",
  "packages/contracts/src/secrets/index.ts",
  "packages/contracts/src/audit/index.ts",
  "packages/contracts/src/storage/index.ts",
  "packages/contracts/src/events/index.ts",
  "apps/api/src/modules/authorization/policy.ts",
  "apps/api/src/modules/projects/project-scope.ts",
  "apps/api/src/modules/authentication/session-token.ts",
  "apps/api/src/modules/secrets/encryption.ts",
  "apps/api/src/modules/audit/audit-event.ts",
  "apps/api/src/modules/storage/storage-policy.ts",
  "apps/api/src/modules/events/event-envelope.ts",
  "apps/api/prisma/schema.prisma",
  "docs/22-layer-01/security-design.md",
  "docs/22-layer-01/test-plan.md",
  "tests/acceptance/layer-01/acceptance-criteria.md"
];

const missing = required.filter(
  (file) => !fs.existsSync(path.resolve(file))
);

if (missing.length) {
  console.error("LAYER 01 VALIDATION FAILED");
  missing.forEach((file) => console.error(`MISSING: ${file}`));
  process.exit(1);
}

const empty = required.filter(
  (file) => fs.statSync(path.resolve(file)).size === 0
);

if (empty.length) {
  console.error("EMPTY REQUIRED FILES");
  empty.forEach((file) => console.error(file));
  process.exit(1);
}

console.log("LAYER 01 STRUCTURE VALIDATION PASSED");
console.log(`Validated ${required.length} required files.`);
