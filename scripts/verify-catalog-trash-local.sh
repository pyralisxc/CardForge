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
cat "$proof/source-identity.txt"
supabase start --help > "$proof/start-help.txt"
supabase db reset --help > "$proof/reset-help.txt"
supabase stop --help > "$proof/stop-help.txt"
supabase migration up --help > "$proof/up-help.txt"
supabase status --help > "$proof/status-help.txt"
grep -q -- '--local' "$proof/up-help.txt"
grep -q -- '--output' "$proof/status-help.txt"
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
# Replay the exact prefix, materialize its repository-owned media, then resume
# every remaining unchanged migration. No repair/skip or migration SQL edits.
mkdir -p "$work/supabase/migrations" "$work/pending"
python3 - "$root/supabase/migrations" "$work" "$proof/migration-hashes.txt" <<'PYHASH'
import pathlib,sys,hashlib,shutil
source,work,receipt=map(pathlib.Path,sys.argv[1:])
lines=[]
for p in sorted(source.glob('*.sql')):
    target=work/('supabase/migrations' if p.name<'20260923203142' else 'pending')/p.name
    shutil.copyfile(p,target)
    lines.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name)
receipt.write_text('\n'.join(lines)+'\n')
PYHASH
# The unchanged config references these local function entrypoints at startup.
cp -R "$root/supabase/functions" "$work/supabase/functions"
python3 - "$work/supabase/config.toml" "$project" <<'PY'
import pathlib, sys, tomllib
p=pathlib.Path(sys.argv[1]); text=p.read_text(); config=tomllib.loads(text)
assert config['project_id']=='cardforge' and config['db']['major_version']==17
assert config['db']['migrations']['enabled'] and not config['db']['seed']['enabled']
p.write_text(text.replace('project_id = "cardforge"', 'project_id = "'+sys.argv[2]+'"', 1))
PY
# Sanitize CLI output in memory before it reaches disk or CI logs.
run_cli() {
  local label=$1; shift
  local status=0
  supabase "$@" 2>&1 | python3 -c '
import re,sys
for line in sys.stdin:
    if not re.search(r"key|token|password|secret|postgres(?:ql)?://|sb_",line,re.I):
        sys.stdout.write(line)
' > "$proof/$label.log" || status=$?
  tail -n 100 "$proof/$label.log"
  return "$status"
}
cleanup() {
  local status=$?
  trap - EXIT
  if [[ $status != 0 ]]; then
    for log in "$proof/fixture.log" "$proof/typed-consumers.log" "$proof/upload-commitments.log" "$proof/contention.log" "$proof/media-backfill.log" "$proof/prefix-prerequisites.log" "$proof/initial-revisions.log" "$proof/plugin-table-conflict.log" "$proof/plugin-bucket-conflict.log" "$proof/plugin-retention.log" "$proof/parent-content-version.log" "$proof/style-review.log" "$proof/editorial-review.log"; do [[ ! -f "$log" ]] || tail -n 100 "$log"; done
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
# Capture the real prefix contract before any preparation; never infer history.
psql_local -c "select r.asset_id,s.revision_number,r.metadata->>'revisionNumber' as registry_revision,s.specialty_tags,s.use_case_tags from public.cardforge_asset_registry r join public.cardforge_contributor_asset_submissions s on s.id=r.contributor_submission_id where s.status='published' order by r.asset_id;" > "$proof/prefix-prerequisites.log"
# These immutable seed sources define the only37 eligible initial rows.
printf '%s\n' '16e2b2d2fb028af10d0febe394200643bb3645f16738371ecbcb0ba7805a7c05  supabase/migrations/202605230002_asset_registry.sql' 'fa33f564a6627bea67224b0b8de854c98a2e3205d548d1a570fb918a020e9e1f  supabase/migrations/202605240002_official_layout_registry_content.sql' | sha256sum --check > "$proof/seed-source-hashes.log"
psql_local -v replay_project="$project" -f "$root/supabase/tests/catalog_replay_initialization.sql" > "$proof/initial-revisions.log" 2>&1
CARDFORGE_LOCAL_DB_CONTAINER="$cid" node "$root/scripts/backfill-local-pipeline-media.mjs" "$work" > "$proof/media-backfill.log" 2>&1
cat "$proof/media-backfill.log"
cp "$work/pending/"*.sql "$work/supabase/migrations/"
(cd "$work/supabase/migrations" && sha256sum --check "$proof/migration-hashes.txt") > "$proof/migration-hash-check.log"
# Exercise the exact unapplied proposal against incompatible preexisting state.
# Both cases retain the sentinel only inside an outer rollback transaction.
plugin_migration="$root/supabase/migrations/20261026220000_private_plugin_release_artifacts.sql"
for conflict in table bucket; do
  table_conflict=false; [[ $conflict != table ]] || table_conflict=true
  psql_local -v plugin_migration="$plugin_migration" -v table_conflict="$table_conflict" \
    -f "$root/supabase/tests/plugin_release_migration_conflicts.sql" > "$proof/plugin-$conflict-conflict.log" 2>&1
  expected=plugin_release_bucket_contract_conflict
  [[ $conflict != table ]] || expected=plugin_release_existing_table_requires_review
  grep -q "ERROR:  $expected" "$proof/plugin-$conflict-conflict.log"
  cat "$proof/plugin-$conflict-conflict.log"
done
run_cli remaining migration up --workdir "$work" --local
psql_local -c "BEGIN; SET LOCAL cardforge.fixture_disposable = 'plugin-releases';" \
  -f "$root/supabase/tests/plugin_release_retention.sql" -c 'ROLLBACK;' > "$proof/plugin-retention.log" 2>&1
cat "$proof/plugin-retention.log"
psql_local -c "SET cardforge.fixture_disposable = 'parent-content-version';" \
  -f "$root/supabase/tests/pipeline_parent_content_version.sql" > "$proof/parent-content-version.log" 2>&1
cat "$proof/parent-content-version.log"
psql_local -f "$root/supabase/tests/pipeline_editorial_review_regression.sql" > "$proof/editorial-review.log" 2>&1
cat "$proof/editorial-review.log"
psql_local -c "SET cardforge.fixture_disposable = 'style-review';" \
  -f "$root/supabase/tests/pipeline_style_review.sql" > "$proof/style-review.log" 2>&1
cat "$proof/style-review.log"
# Reset with --no-seed still executes migration-owned INSERTs. Only this fresh,
# container-bound ephemeral CI stack is cleared. The SQL fixture itself keeps
# its strict refusal of an existing catalog; never copy this into a migration
# or a hosted/Staging procedure. Destruction is confined to this runner's DB.
[[ $(docker inspect --format '{{.Id}}' "$container") == "$cid" ]]
psql_local -c 'TRUNCATE public.cardforge_asset_registry, public.cardforge_contributor_asset_submissions, public.cardforge_pipeline_asset_lineages, public.cardforge_studio_documents CASCADE;' > "$proof/disposable-fixture-setup.log" 2>&1
psql_local -f "$root/supabase/tests/catalog_recoverable_trash.sql" > "$proof/fixture.log" 2>&1 || { cat "$proof/fixture.log"; exit 1; }
psql_local -f "$root/supabase/tests/studio_catalog_dependencies.sql" > "$proof/studio-dependencies.log" 2>&1 || { cat "$proof/studio-dependencies.log"; exit 1; }
cat "$proof/studio-dependencies.log"
psql_local -f "$root/supabase/tests/catalog_typed_consumers.sql" > "$proof/typed-consumers.log" 2>&1 || { cat "$proof/typed-consumers.log"; exit 1; }
cat "$proof/typed-consumers.log"
psql_local -f "$root/supabase/tests/pipeline_upload_commitments.sql" > "$proof/upload-commitments.log" 2>&1 || { cat "$proof/upload-commitments.log"; exit 1; }
cat "$proof/upload-commitments.log"
CARDFORGE_LOCAL_DB_CONTAINER="$cid" python3 "$root/scripts/test-catalog-trash-contention.py" > "$proof/contention.log" 2>&1 || { cat "$proof/contention.log"; exit 1; }
cat "$proof/fixture.log" "$proof/contention.log"
