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
