import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, chmod, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("clean local install migrations and PostgreSQL backup/restore are exercised", {
  skip: !process.env.DATABASE_URL,
  timeout: 180_000,
}, async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "freeai-ops-e2e-"));
  await chmod(temp, 0o700);
  const suffix = randomBytes(5).toString("hex");
  const installDb = `freeai_install_${suffix}`;
  const restoreDb = `freeai_restore_${suffix}`;
  const occupiedDb = `freeai_occupied_${suffix}`;
  const sourceService = path.join(temp, "source.pg_service.conf");
  const installService = path.join(temp, "install.pg_service.conf");
  const restoreService = path.join(temp, "restore.pg_service.conf");
  const occupiedService = path.join(temp, "occupied.pg_service.conf");
  const backup = path.join(temp, "freeai.backup");
  const sourceUrl = new URL(process.env.DATABASE_URL);
  const targetUrl = (database) => {
    const url = new URL(sourceUrl);
    url.pathname = `/${database}`;
    return url.toString();
  };
  const urls = { source: process.env.DATABASE_URL, install: targetUrl(installDb), restore: targetUrl(restoreDb), occupied: targetUrl(occupiedDb) };
  const created = new Set();
  t.after(async () => {
    for (const database of created) {
      const service = database === installDb ? installService : database === restoreDb ? restoreService : occupiedService;
      spawnSync("dropdb", ["--if-exists", database], { env: serviceEnv(service), stdio: "ignore" });
    }
    await rm(temp, { recursive: true, force: true });
  });

  await writeService("DATABASE_URL", urls.source, sourceService);
  await createDatabase(installDb, sourceService); created.add(installDb);
  await createDatabase(restoreDb, sourceService); created.add(restoreDb);
  await createDatabase(occupiedDb, sourceService); created.add(occupiedDb);
  await writeService("DATABASE_URL", urls.install, installService);
  await writeService("RESTORE_DATABASE_URL", urls.restore, restoreService);
  await writeService("RESTORE_DATABASE_URL", urls.occupied, occupiedService);

  const install = run("bash", ["scripts/install-local.sh"], {
    ...process.env,
    DATABASE_URL: urls.install,
    BOOTSTRAP_TOKEN: randomBytes(32).toString("base64url"),
    SECRETS_MASTER_KEY: randomBytes(32).toString("base64"),
  });
  assert.equal(install.status, 0, `clean local installation failed (${install.status ?? install.error?.code ?? "unknown"})`);
  assert.ok(install.stdout.includes("INSTALLATION_READY"));
  const installedRows = query(installService, "SELECT count(*) FROM global_model_policy");
  assert.equal(installedRows, "1");

  const backupResult = run("bash", ["scripts/backup-postgres.sh", backup], { ...process.env, DATABASE_URL: urls.source });
  assert.equal(backupResult.status, 0, `backup failed (${backupResult.status ?? backupResult.error?.code ?? "unknown"})`);
  assert.equal(run("bash", ["scripts/backup-postgres.sh", backup], { ...process.env, DATABASE_URL: urls.source }).status, 2,
    "backup must refuse to overwrite an existing artifact");
  assert.equal(run("bash", ["scripts/restore-postgres.sh", backup], { ...process.env, RESTORE_DATABASE_URL: urls.restore }).status, 2,
    "restore must require explicit empty-target confirmation");

  run("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-c", "CREATE TABLE restore_guard (id integer PRIMARY KEY)"], serviceEnv(occupiedService), 0);
  const refused = run("bash", ["scripts/restore-postgres.sh", backup], {
    ...process.env, RESTORE_DATABASE_URL: urls.occupied, RESTORE_CONFIRM_EMPTY: "I_HAVE_VERIFIED_EMPTY_TARGET",
  });
  assert.notEqual(refused.status, 0, "restore must fail without cleaning an occupied database");

  const sourceCounts = queryCounts(sourceService);
  const restore = run("bash", ["scripts/restore-postgres.sh", backup], {
    ...process.env, RESTORE_DATABASE_URL: urls.restore, RESTORE_CONFIRM_EMPTY: "I_HAVE_VERIFIED_EMPTY_TARGET",
  });
  assert.equal(restore.status, 0, `restore failed (${restore.status ?? restore.error?.code ?? "unknown"}): ${restore.stderr}`);
  assert.ok(restore.stdout.includes("RESTORE_SUCCEEDED"));
  assert.deepEqual(queryCounts(restoreService), sourceCounts);

  function serviceEnv(serviceFile) {
    return { ...process.env, PGSERVICEFILE: serviceFile, PGSERVICE: "freeai" };
  }
  function run(command, args, env = process.env, expectedStatus) {
    const result = spawnSync(command, args, { cwd: process.cwd(), env, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (expectedStatus !== undefined) assert.equal(result.status, expectedStatus, `database operation failed: ${command}`);
    return result;
  }
  async function writeService(variable, url, destination) {
    const result = run(process.execPath, ["scripts/write-pg-service.mjs", variable, destination], { ...process.env, [variable]: url });
    assert.equal(result.status, 0, "private PostgreSQL connection file creation failed");
  }
  async function createDatabase(name, serviceFile) {
    run("createdb", [name], { ...serviceEnv(serviceFile), PGDATABASE: "postgres" }, 0);
  }
  function query(serviceFile, sql) {
    const result = run("psql", ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql], serviceEnv(serviceFile));
    assert.equal(result.status, 0, "PostgreSQL verification query failed");
    return result.stdout.trim();
  }
  function queryCounts(serviceFile) {
    const value = query(serviceFile, "SELECT (SELECT count(*) FROM tenants)::text || ':' || (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL)::text");
    const [tenants, migrations] = value.split(":").map(Number);
    return { tenants, migrations };
  }
});
