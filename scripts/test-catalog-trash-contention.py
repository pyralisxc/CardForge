"""Native two-session psql proof, only in the owned disposable CI container."""
import json
import os
import queue
import subprocess
import threading
import time
import uuid

assert os.environ.get('GITHUB_ACTIONS') == 'true'
assert os.environ.get('RUNNER_ENVIRONMENT') == 'github-hosted'
assert not os.environ.get('DOCKER_HOST')
cid = os.environ['CARDFORGE_LOCAL_DB_CONTAINER']
assert len(cid) == 64 and all(c in '0123456789abcdef' for c in cid)
info = json.loads(subprocess.check_output(['docker', 'inspect', cid], text=True))[0]
assert info['Name'] == '/supabase_db_cf-trash-' + os.environ['GITHUB_RUN_ID'] + '-' + os.environ['GITHUB_RUN_ATTEMPT']
assert subprocess.check_output(['docker', 'context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], text=True).strip().startswith('unix://')
assert 'supabase/postgres:17.' in info['Config']['Image']
assert info['NetworkSettings']['Ports']['5432/tcp'][0]['HostPort'] == '54322'
args = ['psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'postgres']


class Session:
    def __init__(self):
        self.output = queue.Queue()
        self.process = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.STDOUT, text=True, bufsize=1,
                                        env={'PATH': os.environ['PATH'], 'PGPASSWORD': 'postgres'})
        def collect():
            for line in self.process.stdout:
                self.output.put(line.rstrip())
            self.output.put(None)
        threading.Thread(target=collect, daemon=True).start()

    def run(self, sql):
        marker = 'ready_' + uuid.uuid4().hex
        self.process.stdin.write(sql + '\n\\echo ' + marker + '\n')
        self.process.stdin.flush()
        lines = []
        deadline = time.monotonic() + 10
        while True:
            line = self.output.get(timeout=max(0.01, deadline - time.monotonic()))
            if line == marker:
                return [line for line in lines if line]
            if line is None:
                raise RuntimeError('psql exited: ' + '\n'.join(lines))
            lines.append(line)

    def close(self):
        if self.process.poll() is None:
            self.process.stdin.write('ROLLBACK;\n\\q\n')
            self.process.stdin.flush()
            self.process.wait(timeout=5)


def fixture(session):
    lineage, current, old = (str(uuid.uuid4()) for _ in range(3))
    asset = 'contention-' + lineage
    session.run(f"""
      insert into public.cardforge_pipeline_asset_lineages(id,registry_asset_id,revision_high_water) values('{lineage}','{asset}',2);
      insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source)
        values('{asset}','Contention proof','icon','https://example.invalid/retained.svg','published','free','contributor');
      insert into public.cardforge_contributor_asset_submissions
        (id,lineage_id,contributor_id,asset_type,name,status,editorial_review_status,calculated_access_tier,
          registry_asset_id,target_registry_asset_id,revision_number,published_at,source_url,trashed_at,purge_after,trash_reason)
        values('{current}','{lineage}','isolated-contention','icons','Contention proof','published','approved','free','{asset}','{asset}',2,now(),
          'https://example.invalid/retained.svg',null,null,null),
        ('{old}','{lineage}','isolated-contention','icons','Old contention proof','archived','approved','hidden','{asset}','{asset}',1,null,
          'https://example.invalid/old.svg',now()-interval '32 days',now()-interval '2 days','expired');
      update public.cardforge_asset_registry set contributor_submission_id='{current}' where asset_id='{asset}';
    """)
    state = json.loads(session.run(f"select public.cardforge_read_catalog_trash('{current}')::text;")[-1])['state']
    return lineage, current, old, state


def command(action, state, held='null'):
    return "public.cardforge_change_catalog_trash('isolated-owner','" + action + "','" + json.dumps(state) + "'::jsonb," + held + ")"


def expect_busy(session, expression):
    session.run(f"""set statement_timeout='2s';
      do $$ begin
        begin perform {expression}; raise exception 'expected_55P03';
        exception when lock_not_available then null; end;
      end $$;""")


def expect_conflict(session, expression, reason):
    session.run(f"""do $$ begin
      begin perform {expression}; raise exception 'expected_native_conflict';
      exception when raise_exception then if sqlerrm<>'{reason}' then raise; end if; end;
    end $$;""")


a, b = Session(), Session()
try:
    a.run("set role service_role; set statement_timeout='5s';")
    b.run("set role service_role; set statement_timeout='2s';")
    # Studio source-owned interpretation uses native digest/revision binding.
    # Run this group before creating unrelated destructive claims below.
    literal = {"version": 1, "userTemplates": [{"id": "literal", "name": "Literal", "aspectRatio": "2:3",
        "freeformCanvas": {"width": 300, "height": 450, "elements": []}}], "storedCards": [], "cardSets": []}
    def studio_values(payload):
        # Synthetic trusted descriptor for a fully literal template; production
        # interpretation is covered separately through its TypeScript owner.
        proof = {"contractVersion": 1, "complete": True, "references": [payload['userTemplates'][0]['id']],
                 "opaqueReasons": [], "sourcePayload": payload}
        return "'" + json.dumps(payload) + "'::jsonb", "'" + json.dumps(proof) + "'::jsonb"
    lineage, current, old, state = fixture(a)
    document = str(uuid.uuid4())
    payload, proof = studio_values(literal)
    a.run(f"insert into public.cardforge_studio_documents(id,owner_user_id,title,document_payload,catalog_dependencies) values('{document}','isolated-contention','Literal',{payload},{proof});")
    dependent = json.loads(json.dumps(literal))
    dependent['userTemplates'][0]['id'] = 'contention-' + lineage
    payload, proof = studio_values(dependent)
    a.run('begin;')
    a.run(f"update public.cardforge_studio_documents set document_payload={payload},catalog_dependencies={proof},revision=revision+1 where id='{document}';")
    expect_busy(b, command('trash', state))
    a.run('commit;')
    expect_conflict(b, command('trash', state), 'catalog_trash_dependency_blocked')
    a.run(f"delete from public.cardforge_studio_documents where id='{document}';")
    print('PASS: Studio writer wins; committed dependency prevents Trash')

    # Actual COMMIT winner, not a rolled-back lock simulation. Each writer must
    # wait for SHARE, then observe committed Trash and reject its new reference.
    backend_b = int(b.run('select pg_backend_pid();')[-1])
    for mode in ['insert', 'update']:
        lineage, current, old, state = fixture(a)
        document = str(uuid.uuid4())
        if mode == 'update':
            payload, proof = studio_values(literal)
            a.run(f"insert into public.cardforge_studio_documents(id,owner_user_id,title,document_payload,catalog_dependencies) values('{document}','isolated-contention','Literal',{payload},{proof});")
        dependent = json.loads(json.dumps(literal))
        dependent['userTemplates'][0]['id'] = 'contention-' + lineage
        payload, proof = studio_values(dependent)
        statement = (f"insert into public.cardforge_studio_documents(id,owner_user_id,title,document_payload,catalog_dependencies) values('{document}','isolated-contention','Queued',{payload},{proof})"
                     if mode == 'insert' else f"update public.cardforge_studio_documents set document_payload={payload},catalog_dependencies={proof},revision=revision+1 where id='{document}'")
        a.run('begin;')
        a.run('select ' + command('trash', state) + ';')
        result = queue.Queue()
        def queued_write():
            try:
                result.put(b.run("do $$ begin begin " + statement + "; raise exception 'queued_writer_was_admitted'; exception when raise_exception then if sqlerrm<>'studio_catalog_reference_unavailable' then raise; end if; end; end $$;"))
            except Exception as error:
                result.put(error)
        worker = threading.Thread(target=queued_write)
        worker.start()
        deadline = time.monotonic() + 1.5
        while a.run(f"select cardinality(pg_blocking_pids({backend_b}))>0;")[-1] != 't':
            assert time.monotonic() < deadline, 'Studio writer did not actually wait behind Trash'
            time.sleep(0.01)
        a.run('commit;')
        worker.join(timeout=5)
        assert not worker.is_alive(), 'Studio writer did not finish after Trash COMMIT'
        outcome = result.get(timeout=1)
        if isinstance(outcome, Exception):
            raise outcome
        if mode == 'insert':
            assert a.run(f"select count(*) from public.cardforge_studio_documents where id='{document}';")[-1] == '0'
        else:
            assert a.run(f"select document_payload->'userTemplates'->0->>'id' from public.cardforge_studio_documents where id='{document}';")[-1] == 'literal'
            a.run(f"delete from public.cardforge_studio_documents where id='{document}';")
        print('PASS: Trash COMMIT then queued Studio ' + mode.upper() + ' rejects new dependency')

    lineage, current, old, state = fixture(a)
    # A owns the lineage before its submission UPDATE (the real claim order).
    # B takes its SHARE table locks then must fail immediately on that lineage,
    # rather than waiting while preventing A's ROW EXCLUSIVE acquisition.
    a.run(f"begin; select id from public.cardforge_pipeline_asset_lineages where id='{lineage}' for update;")
    expect_busy(b, command('trash', state))
    assert a.run(f"select count(*) from public.cardforge_claim_pipeline_revision_purge_target('{old}');")[-1] == '1'
    a.run('commit;')
    for action in ['trash', 'restore', 'hold']:
        expect_conflict(b, command(action, state, 'true' if action == 'hold' else 'null'), 'catalog_trash_already_claimed')
    print('PASS: Move fails fast behind lineage owner; claim UPDATE proceeds; commitment blocks Move/Restore/Hold')

    lineage, current, old, state = fixture(a)
    a.run('begin;')
    trashed = json.loads(a.run('select ' + command('trash', state) + '::text;')[-1])['state']
    # SKIP LOCKED must not hand any Storage work to the other session.
    assert b.run(f"select count(*) from public.cardforge_claim_pipeline_revision_purge_target('{old}');")[-1] == '0'
    a.run('commit;')
    # A rejected expiry attempt still holds its lineage lock until transaction
    # end; both Hold and Restore must fail fast without a table-lock cycle.
    b.run('begin;')
    assert b.run(f"select count(*) from public.cardforge_claim_pipeline_revision_purge_target('{old}');")[-1] == '0'
    expect_busy(a, command('hold', trashed, 'true'))
    expect_busy(a, command('restore', trashed))
    b.run('commit;')
    held = json.loads(a.run('select ' + command('hold', trashed, 'true') + '::text;')[-1])['state']
    assert held['held'] and held['purgeAfter'] == trashed['purgeAfter']
    restored = json.loads(a.run('select ' + command('restore', held) + '::text;')[-1])['state']
    assert restored['trashedAt'] is None
    assert b.run(f"select count(*) from public.cardforge_claim_pipeline_revision_purge_target('{old}');")[-1] == '1'
    expect_conflict(a, command('restore', held), 'catalog_trash_state_changed')
    expect_conflict(a, command('hold', held, 'true'), 'catalog_trash_state_changed')
    print('PASS: Move wins against expiry; Hold/Restore fail fast on contention; stale recovery cannot cross a later commitment')
    # An in-flight authoritative consumer write cannot race a negative scan.
    lineage, current, old, state = fixture(a)
    consumer = 'concurrent-style-' + uuid.uuid4().hex
    a.run("begin;")
    a.run(f"""insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source,metadata)
      values('{consumer}','Concurrent Style','elementPreset','https://example.invalid/style.json','published','free','official',
       '{{"style":{{"id":"{consumer}","name":"Concurrent Style","kind":"material","targets":["shape"],"appearance":{{"assetSource":"contention-{lineage}"}}}}}}');""")
    expect_busy(b, command('trash', state))
    a.run('commit;')
    reasons = json.loads(b.run(f"select public.cardforge_read_catalog_trash('{current}')::text;")[-1])['entryReasons']
    assert 'pipeline_identity_consumer_requires_resolution' in reasons
    expect_conflict(b, command('trash', state), 'catalog_trash_dependency_blocked')
    a.run(f"delete from public.cardforge_asset_registry where asset_id='{consumer}';")
    print('PASS: concurrent registry consumer write blocks Move; committed target reference is observed')

    # Exact-object upload authority spans Storage I/O, not a row lookup followed
    # by deletion. These transactions exercise both winners under the same lock.
    descriptor = {"assetType": "icons", "fileName": "proof.svg", "fileSizeBytes": 100,
                  "mimeType": "image/svg+xml", "transportExtension": "cfsvg"}
    descriptor_sql = json.dumps(descriptor)
    def reserve_upload():
        return json.loads(a.run("select public.cardforge_reserve_pipeline_upload('race-owner','" + descriptor_sql + "'::jsonb)::text;")[-1])['storagePath']
    def prepare_upload(path):
        request = {"contributor_id": "race-owner", "asset_type": "icons", "source_storage_bucket": "cardforge-contributor-assets", "source_storage_path": path}
        return "public.cardforge_prepare_pipeline_upload_submission('race-owner','" + path + "','" + descriptor_sql + "'::jsonb,'" + json.dumps(request) + "'::jsonb,true)"
    path = reserve_upload()
    a.run('begin;')
    a.run('select ' + prepare_upload(path) + ';')
    cleanup = "public.cardforge_claim_pipeline_upload_cleanup('race-owner','" + path + "')"
    expect_busy(b, cleanup)
    a.run('commit;')
    expect_conflict(b, cleanup, 'pipeline_upload_cleanup_blocked')
    print('PASS: upload submission commitment wins; cleanup cannot obtain authority during or after transaction')
    path = reserve_upload()
    a.run('begin;')
    a.run("select public.cardforge_claim_pipeline_upload_cleanup('race-owner','" + path + "');")
    expect_busy(b, prepare_upload(path))
    a.run('commit;')
    expect_conflict(b, prepare_upload(path), 'pipeline_upload_cleanup_committed')
    expect_conflict(b, "public.cardforge_claim_pipeline_upload_cleanup('race-owner','" + path + "')", 'pipeline_upload_cleanup_blocked')
    print('PASS: cleanup commitment wins; submission and duplicate cleanup remain excluded without any lease reset')

finally:
    a.close()
    b.close()
