#!/usr/bin/env bash
# Only disposable GitHub-hosted CI. No remote URL, hosted link, or caller target.
set -euo pipefail
[[ ${GITHUB_ACTIONS:-} == true && ${RUNNER_ENVIRONMENT:-} == github-hosted ]] || { echo 'Requires an ephemeral GitHub-hosted runner'; exit 1; }
[[ -z ${DOCKER_HOST:-} && -z ${SUPABASE_ACCESS_TOKEN:-} && -z ${SUPABASE_DB_PASSWORD:-} ]] || { echo 'Remote Docker/provider configuration is not allowed'; exit 1; }
case "$(docker context inspect --format '{{.Endpoints.docker.Host}}')" in unix://*) ;; *) echo 'Requires a local Unix Docker daemon'; exit 1;; esac
[[ $(supabase --version) == 2.122.0 ]] || { echo 'Expected official Supabase CLI 2.122.0'; exit 1; }
root=$(git rev-parse --show-toplevel)
proof="$root/test-results/native-catalog-trash"
mkdir -p "$proof"
git rev-parse HEAD HEAD^{tree} > "$proof/source-identity.txt"
supabase start --help > "$proof/start-help.txt"
supabase db reset --help > "$proof/reset-help.txt"
supabase stop --help > "$proof/stop-help.txt"
grep -q -- '--local' "$proof/reset-help.txt"
grep -q -- '--no-seed' "$proof/reset-help.txt"
grep -q -- '--no-backup' "$proof/stop-help.txt"
work=$(mktemp -d /tmp/cardforge-native-trash.XXXXXXXX)
project="cf-trash-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
container="supabase_db_${project}"
[[ -z $(docker ps -aq --filter "name=^/${container}$") ]] || { echo 'Refusing an existing database container'; exit 1; }
[[ -z $(docker volume ls -q --filter "name=${project}") ]] || { echo 'Refusing existing project volumes'; exit 1; }
mkdir -p "$work/supabase"
cp "$root/supabase/config.toml" "$work/supabase/config.toml"
cp -R "$root/supabase/migrations" "$work/supabase/migrations"
python3 - "$work/supabase/config.toml" "$project" <<'PY'
import pathlib, sys, tomllib
p=pathlib.Path(sys.argv[1]); text=p.read_text(); config=tomllib.loads(text)
assert config['project_id']=='cardforge' and config['db']['major_version']==17
assert config['db']['migrations']['enabled'] and not config['db']['seed']['enabled']
p.write_text(text.replace('project_id = "cardforge"', 'project_id = "'+sys.argv[2]+'"', 1))
PY
# CLI status may contain local generated keys. Preserve sanitized replay output,
# never emit raw status/configuration or capture container environment variables.
redact() {
  python3 - "$1" "$2" <<'PY'
import pathlib,re,sys
lines=pathlib.Path(sys.argv[1]).read_text(errors='replace').splitlines()
lines=[line for line in lines if not re.search(r'key|token|password|secret|postgres(?:ql)?://|sb_',line,re.I)]
pathlib.Path(sys.argv[2]).write_text('\n'.join(lines)+'\n')
PY
}
run_cli() {
  local label=$1; shift
  local status=0
  supabase "$@" > "$work/$label.raw" 2>&1 || status=$?
  redact "$work/$label.raw" "$proof/$label.log"
  tail -n 100 "$proof/$label.log"
  return "$status"
}
cleanup() {
  local status=$?
  trap - EXIT
  if [[ $status != 0 ]]; then
    for log in "$proof/fixture.log" "$proof/contention.log"; do [[ ! -f "$log" ]] || tail -n 100 "$log"; done
  fi
  run_cli stop stop --workdir "$work" --no-backup || status=1
  rm -rf -- "$work"
  exit "$status"
}
trap cleanup EXIT
run_cli start start --workdir "$work"
run_cli replay db reset --workdir "$work" --local --no-seed
cid=$(docker inspect --format '{{.Id}}' "$container")
image=$(docker inspect --format '{{.Config.Image}}' "$cid")
case "$image" in *supabase/postgres:17.*) ;; *) echo 'Expected a versioned official PostgreSQL17 image'; exit 1;; esac
[[ $(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$cid") == 54322 ]] || { echo 'Unexpected local database port'; exit 1; }
docker inspect --format '{{.Id}} {{.Image}} {{.Config.Image}} {{.Created}}' "$cid" > "$proof/database-identity.txt"
# Explicit local parameters override PG service/host environment. This password
# is the official disposable local development default, never a provider secret.
psql_local() { env -i PATH="$PATH" PGPASSWORD=postgres psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 54322 -U postgres -d postgres "$@"; }
psql_local -c "do \$\$ begin if current_setting('server_version_num')::int not between 170000 and 179999 then raise exception 'PostgreSQL17 required'; end if; end \$\$;" > "$proof/version.log"
# Reset with --no-seed still executes migration-owned INSERTs. Only this fresh,
# container-bound ephemeral CI stack is cleared. The SQL fixture itself keeps
# its strict refusal of an existing catalog; never copy this into a migration
# or a hosted/Staging procedure. Destruction is confined to this runner's DB.
[[ $(docker inspect --format '{{.Id}}' "$container") == "$cid" ]]
psql_local -c 'TRUNCATE public.cardforge_asset_registry, public.cardforge_contributor_asset_submissions, public.cardforge_pipeline_asset_lineages, public.cardforge_studio_documents CASCADE;' > "$proof/disposable-fixture-setup.log" 2>&1
psql_local -f "$root/supabase/tests/catalog_recoverable_trash.sql" > "$proof/fixture.log" 2>&1
CARDFORGE_LOCAL_DB_CONTAINER="$cid" python3 "$root/scripts/test-catalog-trash-contention.py" > "$proof/contention.log" 2>&1
cat "$proof/fixture.log" "$proof/contention.log"
