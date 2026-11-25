import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
let passed = 0;
let failed = 0;
let warnings = 0;

function report(type, name, detail = "") {
  const labels = {
    PASS: "[PASS]",
    FAIL: "[FAIL]",
    WARN: "[WARN]",
    SKIP: "[SKIP]",
  };

  console.log(`${labels[type]} ${name}${detail ? ` — ${detail}` : ""}`);

  if (type === "PASS") passed++;
  if (type === "FAIL") failed++;
  if (type === "WARN") warnings++;
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function read(relativePath) {
  const file = path.join(ROOT, relativePath);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function checkFile(file, label = file) {
  if (!exists(file)) {
    report("FAIL", label, "الملف غير موجود");
    return false;
  }

  const stat = fs.statSync(path.join(ROOT, file));

  if (!stat.isFile() || stat.size === 0) {
    report("FAIL", label, "الملف فارغ أو ليس ملفاً عادياً");
    return false;
  }

  report("PASS", label);
  return true;
}

function checkDirectory(dir) {
  const full = path.join(ROOT, dir);

  if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
    report("PASS", `Directory ${dir}`);
    return true;
  }

  report("FAIL", `Directory ${dir}`, "المجلد غير موجود");
  return false;
}

function checkJson(file) {
  if (!checkFile(file)) return;

  try {
    JSON.parse(read(file));
    report("PASS", `JSON ${file}`, "صيغة صحيحة");
  } catch (error) {
    report("FAIL", `JSON ${file}`, error.message);
  }
}

function checkContains(file, patterns, label) {
  if (!exists(file)) {
    report("FAIL", label, `الملف غير موجود: ${file}`);
    return;
  }

  const content = read(file);
  const missing = patterns.filter((pattern) => !pattern.test(content));

  if (missing.length === 0) {
    report("PASS", label);
  } else {
    report(
      "FAIL",
      label,
      `عناصر غير موجودة: ${missing.length}`
    );
  }
}

function section(name) {
  console.log(`\n========== ${name} ==========`);
}

// 1. Workspace
section("01 — WORKSPACE");

[
  "apps/api",
  "apps/web",
  "packages/contracts",
  "packages/shared",
  "packages/config",
  "services/ai-runtime",
  "infra",
  "docs",
  "tests",
  "scripts",
].forEach(checkDirectory);

[
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
].forEach((file) => {
  if (file.endsWith(".json")) checkJson(file);
  else checkFile(file);
});

[
  "apps/api/package.json",
  "apps/web/package.json",
  "packages/contracts/package.json",
  "packages/shared/package.json",
  "packages/config/package.json",
  "services/ai-runtime/package.json",
].forEach(checkJson);

// 2. Layer 01 expected files
section("02 — LAYER 01 FILES");

[
  "apps/api/src/infrastructure/database/prisma.ts",
  "apps/api/src/infrastructure/database/transaction.ts",
  "apps/api/src/infrastructure/database/tenant-context.ts",
  "apps/api/src/modules/identity/identity.service.ts",
  "apps/api/src/modules/authentication/authentication.service.ts",
  "apps/api/src/modules/authorization/authorization.service.ts",
  "apps/api/src/modules/settings/settings.service.ts",
  "apps/api/src/modules/audit/audit.service.ts",
  "apps/api/src/modules/events/outbox.service.ts",
  "apps/api/prisma/schema.prisma",
  "scripts/check-layer-01.mjs",
  "scripts/check-layer-01-core.mjs",
].forEach(checkFile);

// 3. Prisma schema
section("03 — PRISMA SCHEMA");

const schemaPath = "apps/api/prisma/schema.prisma";

if (checkFile(schemaPath)) {
  const schema = read(schemaPath);

  const requiredModels = [
    "Tenant",
    "Project",
    "User",
    "Session",
    "Role",
    "Permission",
    "UserRole",
    "RolePermission",
    "Setting",
    "AuditLog",
  ];

  for (const model of requiredModels) {
    const pattern = new RegExp(`model\\s+${model}\\s*\\{`);
    if (pattern.test(schema)) {
      report("PASS", `Prisma model ${model}`);
    } else {
      report("FAIL", `Prisma model ${model}`, "غير موجود");
    }
  }

  if (/provider\s*=\s*"postgresql"/.test(schema)) {
    report("PASS", "PostgreSQL datasource");
  } else {
    report("FAIL", "PostgreSQL datasource");
  }

  const relationModels = [
    "User",
    "Session",
    "Role",
    "Permission",
    "UserRole",
    "RolePermission",
  ];

  for (const model of relationModels) {
    const start = schema.indexOf(`model ${model} {`);
    if (start < 0) continue;

    const end = schema.indexOf("\n}", start);
    const block = schema.slice(start, end < 0 ? undefined : end);

    if (/@relation/.test(block)) {
      report("PASS", `Relation declaration in ${model}`);
    } else {
      report("FAIL", `Relation declaration in ${model}`,
        "لا توجد @relation داخل النموذج");
    }
  }
}

// 4. Database security / RLS
section("04 — DATABASE SECURITY");

const migrationDir = "apps/api/prisma/migrations";
const migrationRoot = path.join(ROOT, migrationDir);

if (!fs.existsSync(migrationRoot)) {
  report("FAIL", "Prisma migrations directory", "غير موجود");
} else {
  const sqlFiles = [];

  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) walk(full);
      else if (item.name.endsWith(".sql")) sqlFiles.push(full);
    }
  }

  walk(migrationRoot);

  if (sqlFiles.length === 0) {
    report("FAIL", "SQL migrations", "لا توجد ملفات SQL");
  } else {
    report("PASS", "SQL migrations", `${sqlFiles.length} ملف`);

    const sql = sqlFiles
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");

    if (/ENABLE ROW LEVEL SECURITY/i.test(sql)) {
      report("PASS", "RLS enable statements");
    } else {
      report("FAIL", "RLS enable statements");
    }

    if (/CREATE POLICY/i.test(sql)) {
      report("PASS", "RLS policies");
    } else {
      report("FAIL", "RLS policies");
    }

    if (/tenant_id/i.test(sql)) {
      report("PASS", "Tenant scope reference");
    } else {
      report("FAIL", "Tenant scope reference");
    }

    if (/project_id/i.test(sql)) {
      report("PASS", "Project scope reference");
    } else {
      report("FAIL", "Project scope reference",
        "لم يظهر project_id في ملفات SQL");
    }

    if (/current_setting\s*\(/i.test(sql)) {
      report("PASS", "Database session context reference");
    } else {
      report("FAIL", "Database session context reference");
    }
  }
}

// 5. Service implementation signals
section("05 — CORE SERVICE SIGNALS");

checkContains(
  "apps/api/src/modules/authentication/authentication.service.ts",
  [/session/i, /expiresAt|expires_at/i],
  "Authentication session and expiry signals"
);

checkContains(
  "apps/api/src/modules/authorization/authorization.service.ts",
  [/permission/i, /role/i],
  "Authorization role and permission signals"
);

checkContains(
  "apps/api/src/modules/identity/identity.service.ts",
  [/tenantId|tenant_id/i, /email/i],
  "Identity tenant and email signals"
);

checkContains(
  "apps/api/src/modules/settings/settings.service.ts",
  [/tenantId|tenant_id/i, /projectId|project_id/i],
  "Settings tenant and project scope signals"
);

checkContains(
  "apps/api/src/modules/audit/audit.service.ts",
  [/audit/i, /metadata/i],
  "Audit event and metadata signals"
);

checkContains(
  "apps/api/src/modules/events/outbox.service.ts",
  [/outbox/i, /event/i],
  "Outbox event signals"
);

// 6. Secret handling
section("06 — SECRET HANDLING");

const secretCandidates = [
  "apps/api/src/infrastructure/secrets",
  "packages/shared/src",
];

let secretImplementationFound = false;

for (const dir of secretCandidates) {
  if (!fs.existsSync(path.join(ROOT, dir))) continue;

  function inspect(dirPath) {
    for (const item of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const full = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        inspect(full);
        continue;
      }

      if (!/\.(ts|js|mjs)$/.test(item.name)) continue;

      const content = fs.readFileSync(full, "utf8");

      if (/aes-256-gcm|createCipheriv|createDecipheriv/i.test(content)) {
        secretImplementationFound = true;
      }
    }
  }

  inspect(path.join(ROOT, dir));
}

if (secretImplementationFound) {
  report("PASS", "Encryption implementation signal");
} else {
  report("WARN", "Encryption implementation signal",
    "لم يتم العثور على مؤشر تشفير معروف في المسارات المفحوصة");
}

const sensitiveFiles = [
  ".env",
  ".env.production",
  "private.pem",
  "private.key",
  "id_rsa",
];

for (const file of sensitiveFiles) {
  if (exists(file)) {
    report("WARN", `Sensitive file present: ${file}`,
      "راجع الصلاحيات ولا تعرض المحتوى");
  }
}

// 7. Empty source files
section("07 — EMPTY SOURCE FILES");

const sourceRoots = [
  "apps",
  "packages",
  "services",
  "tests",
];

let emptyCount = 0;

function inspectEmpty(dir) {
  if (!fs.existsSync(dir)) return;

  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);

    if (item.isDirectory()) {
      if (["node_modules", "dist", "build", ".next"].includes(item.name)) {
        continue;
      }
      inspectEmpty(full);
    } else if (/\.(ts|tsx|js|mjs|json|sql)$/.test(item.name)) {
      if (fs.statSync(full).size === 0) {
        emptyCount++;
        report("FAIL", "Empty source file", path.relative(ROOT, full));
      }
    }
  }
}

sourceRoots.forEach((dir) => inspectEmpty(path.join(ROOT, dir)));

if (emptyCount === 0) {
  report("PASS", "Empty source file scan", "لا توجد ملفات مصدر فارغة");
}

// 8. Existing test scripts — existence only, not trust
section("08 — EXISTING CHECK SCRIPTS");

[
  "scripts/check-structure.mjs",
  "scripts/check-architecture.mjs",
  "scripts/check-contracts.mjs",
  "scripts/check-layer-01.mjs",
  "scripts/check-layer-01-core.mjs",
].forEach((file) => {
  if (exists(file)) {
    report("PASS", `Found ${file}`);
  } else {
    report("WARN", `Missing ${file}`);
  }
});

// 9. Git whitespace validation
section("09 — FINAL SUMMARY");

console.log("\n----------------------------------------");
console.log(`PASSED:   ${passed}`);
console.log(`FAILED:   ${failed}`);
console.log(`WARNINGS: ${warnings}`);
console.log("----------------------------------------");

if (failed > 0) {
  console.error("\nRESULT: FAILED — لا تنتقل للطبقة الثانية.");
  process.exitCode = 1;
} else {
  console.log("\nRESULT: STATIC AUDIT PASSED.");
  console.log("هذا لا يعني أن النظام اجتاز اختبارات التكامل أو الأمان.");
}
