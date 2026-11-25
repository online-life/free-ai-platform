import fs from "node:fs";

const required = [
  "apps/api/src/infrastructure/database/prisma.ts",
  "apps/api/src/infrastructure/database/transaction.ts",
  "apps/api/src/infrastructure/database/tenant-context.ts",
  "apps/api/src/modules/identity/identity.service.ts",
  "apps/api/src/modules/authentication/authentication.service.ts",
  "apps/api/src/modules/authorization/authorization.service.ts",
  "apps/api/src/modules/settings/settings.service.ts",
  "apps/api/src/modules/audit/audit.service.ts",
  "apps/api/src/modules/events/outbox.service.ts",
  "apps/api/src/middleware/authentication.middleware.ts",
  "apps/api/src/middleware/tenant.middleware.ts",
  "apps/api/prisma/migrations/0001_layer01_security/migration.sql"
];

const errors = required.filter(
  (file) => !fs.existsSync(file) || fs.statSync(file).size === 0
);

if (errors.length) {
  console.error("CORE VALIDATION FAILED");
  errors.forEach((file) => console.error(`INVALID: ${file}`));
  process.exit(1);
}

console.log("CORE STRUCTURE VALIDATION PASSED");
console.log(`Validated ${required.length} files.`);
