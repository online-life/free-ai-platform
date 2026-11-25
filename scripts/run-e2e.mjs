import { spawn } from "node:child_process";

if (!process.env.DATABASE_URL?.trim()) {
  console.log("SKIP: API E2E requires DATABASE_URL for a disposable test database.");
  process.exit(0);
}

async function run(command, args) {
  const child = spawn(command, args, { stdio: "inherit" });
  return await new Promise((resolve) => {
    child.once("error", (error) => {
      console.error(`E2E command failed to start: ${error.message}`);
      resolve(1);
    });
    child.once("exit", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

const runtimeBuild = await run("pnpm", ["--filter", "@free-ai/ai-runtime", "build"]);
if (runtimeBuild !== 0) process.exit(runtimeBuild);
process.exitCode = await run(process.execPath, [
  "--test", "--test-concurrency=1",
  "tests/e2e/api-project-flow.test.cjs",
  "tests/e2e/api-error-contract.test.cjs",
  "tests/e2e/auth-session-flow.test.cjs",
  "tests/e2e/runtime-workspace-flow.test.cjs",
  "tests/e2e/process-sandbox.test.mjs",
  "tests/e2e/operations-install-backup-restore.test.mjs",
]);
