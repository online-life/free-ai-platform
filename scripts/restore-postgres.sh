#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${RESTORE_DATABASE_URL:-}" ]]; then
  echo "RESTORE_DATABASE_URL_REQUIRED" >&2
  exit 2
fi
if [[ "${RESTORE_CONFIRM_EMPTY:-}" != "I_HAVE_VERIFIED_EMPTY_TARGET" ]]; then
  echo "RESTORE_CONFIRM_EMPTY_REQUIRED" >&2
  exit 2
fi
if [[ $# -ne 1 ]]; then
  echo "USAGE: restore-postgres.sh BACKUP_FILE" >&2
  exit 2
fi

backup="$1"
if [[ ! -f "$backup" || -L "$backup" || "$(stat -c '%h' -- "$backup")" != "1" ]]; then
  echo "BACKUP_FILE_UNSAFE" >&2
  exit 2
fi
permissions="$(stat -c '%a' -- "$backup")"
if (( (8#$permissions & 077) != 0 )); then
  echo "BACKUP_FILE_PERMISSIONS_UNSAFE" >&2
  exit 2
fi
pg_restore --list "$backup" >/dev/null
service_file="$(mktemp "${TMPDIR:-/tmp}/freeai-restore-service.XXXXXXXX")"
trap 'rm -f -- "$service_file"' EXIT HUP INT TERM
node scripts/write-pg-service.mjs RESTORE_DATABASE_URL "$service_file"
# Tenant tables use FORCE ROW LEVEL SECURITY. pg_dump/pg_restore can only
# read or write them as a superuser or a role with BYPASSRLS; the application
# role must not have either. Fail early with an explicit code instead of a
# partial dump/restore. Use a dedicated backup/restore role.
role_can_bypass_rls="$(PGSERVICEFILE="$service_file" PGSERVICE=freeai psql --no-psqlrc --tuples-only --no-align --dbname="service=freeai" --command="SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user;")"
if [[ "$role_can_bypass_rls" != "t" ]]; then
  echo "RESTORE_ROLE_REQUIRES_BYPASSRLS" >&2
  exit 3
fi
target_objects="$(PGSERVICEFILE="$service_file" PGSERVICE=freeai psql --no-psqlrc --tuples-only --no-align --dbname="service=freeai" --command="SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND c.relkind IN ('r','p','v','m','S','f')) + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')) + (SELECT count(*) FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('information_schema','public'));")"
if [[ "$target_objects" != "0" ]]; then
  echo "RESTORE_TARGET_NOT_EMPTY" >&2
  exit 2
fi
# Restore deliberately omits --clean/--create and checks the target first.
PGSERVICEFILE="$service_file" PGSERVICE=freeai pg_restore --exit-on-error --no-owner --no-acl --dbname="service=freeai" "$backup"
rm -f -- "$service_file"
trap - EXIT HUP INT TERM
echo "RESTORE_SUCCEEDED"
