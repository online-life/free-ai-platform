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
