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
