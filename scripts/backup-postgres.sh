#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL_REQUIRED" >&2
  exit 2
fi
if [[ $# -ne 1 ]]; then
  echo "USAGE: backup-postgres.sh DESTINATION_FILE" >&2
  exit 2
fi

destination="$1"
directory="$(dirname -- "$destination")"
if [[ ! -d "$directory" || -L "$directory" ]]; then
  echo "BACKUP_DIRECTORY_UNSAFE" >&2
  exit 2
fi
directory="$(cd -- "$directory" && pwd -P)"
destination="$directory/$(basename -- "$destination")"
if [[ -e "$destination" || -L "$destination" ]]; then
  echo "BACKUP_DESTINATION_EXISTS" >&2
  exit 2
fi

umask 077
temporary="$(mktemp "$directory/.freeai-pg-backup.XXXXXXXX")"
service_file="$(mktemp "${TMPDIR:-/tmp}/freeai-pg-service.XXXXXXXX")"
trap 'rm -f -- "$temporary" "$service_file"' EXIT HUP INT TERM
node scripts/write-pg-service.mjs DATABASE_URL "$service_file"
# Tenant tables use FORCE ROW LEVEL SECURITY. pg_dump/pg_restore can only
# read or write them as a superuser or a role with BYPASSRLS; the application
# role must not have either. Fail early with an explicit code instead of a
# partial dump/restore. Use a dedicated backup/restore role.
role_can_bypass_rls="$(PGSERVICEFILE="$service_file" PGSERVICE=freeai psql --no-psqlrc --tuples-only --no-align --dbname="service=freeai" --command="SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user;")"
if [[ "$role_can_bypass_rls" != "t" ]]; then
  echo "BACKUP_ROLE_REQUIRES_BYPASSRLS" >&2
  exit 3
fi
PGSERVICEFILE="$service_file" PGSERVICE=freeai pg_dump --format=custom --no-owner --no-acl --file="$temporary"
pg_restore --list "$temporary" >/dev/null
chmod 600 "$temporary"
ln -- "$temporary" "$destination"
rm -- "$temporary"
rm -f -- "$service_file"
trap - EXIT HUP INT TERM
echo "BACKUP_CREATED $(basename -- "$destination")"
