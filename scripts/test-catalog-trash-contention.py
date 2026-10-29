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
    # Exact Set package interpretations share the existing catalog table locks.
    # Native fixtures use synthetic trusted receipts; byte decoding/readback is
    # covered through the real TypeScript/importer owners, never live Storage.
    def set_insert(asset, submission, identities=None, preview=''):
        digest = 'a' * 64
        path = 'owner-defaults/sets/' + asset + '/' + digest + '.cardforge'
        proof = {"contractVersion": 1, "packageSha256": digest, "fileSizeBytes": 42,
                 "projectRevision": 'b' * 64, "sourceManifest": {"projectRevision": 'b' * 64, "project": {}},
                 "complete": True, "references": {"identities": identities or [], "sources": []}, "opaqueReasons": []}
        return ("insert into public.cardforge_contributor_asset_submissions(id,contributor_id,asset_type,name,status,revision_number,"
                "target_registry_asset_id,source_url,source_storage_bucket,source_storage_path,source_file_size_bytes,source_payload,catalog_dependencies,preview_url) values("
                f"'{submission}','isolated-contention','sets','Synthetic Set','submitted',1,'{asset}',"
                f"'https://example.invalid/storage/v1/object/public/cardforge-contributor-assets/{path}',"
                f"'cardforge-contributor-assets','{path}',42,'" + json.dumps({"packageSha256": digest, "portableProject": True}) + "'::jsonb,'"
                + json.dumps(proof) + f"'::jsonb,'{preview}')")

    lineage, current, old, state = fixture(a)
    consumer = str(uuid.uuid4())
    a.run('begin;')
    a.run(set_insert('set-writer-' + consumer, consumer, ['contention-' + lineage]) + ';')
    expect_busy(b, command('trash', state))
    a.run('commit;')
    expect_conflict(b, command('trash', state), 'catalog_trash_dependency_blocked')
    a.run(f"delete from public.cardforge_contributor_asset_submissions where id='{consumer}';")
    print('PASS: Set writer wins; committed typed identity blocks Trash')

    backend_set_writer = int(b.run('select pg_backend_pid();')[-1])
    for mode in ['insert', 'update']:
        lineage, current, old, state = fixture(a)
        target_url = 'https://example.invalid/' + lineage + '.svg'
        a.run(f"update public.cardforge_contributor_asset_submissions set source_url='{target_url}' where id='{current}';")
        a.run(f"update public.cardforge_asset_registry set url='{target_url}' where asset_id='contention-{lineage}';")
        state = json.loads(a.run(f"select public.cardforge_read_catalog_trash('{current}')::text;")[-1])['state']
        consumer = str(uuid.uuid4())
        if mode == 'update':
            a.run(set_insert('set-updated-' + consumer, consumer) + ';')
            statement = f"update public.cardforge_contributor_asset_submissions set preview_url='{target_url}' where id='{consumer}'"
        else:
            statement = set_insert('set-queued-' + consumer, consumer, ['contention-' + lineage])
        a.run('begin;')
        a.run('select ' + command('trash', state) + ';')
        result = queue.Queue()
        def queued_set_write():
            try:
                result.put(b.run("do $$ begin begin " + statement + "; raise exception 'queued_set_admitted'; exception when raise_exception then if sqlerrm<>'set_catalog_reference_unavailable' then raise; end if; end; end $$;"))
            except Exception as error:
                result.put(error)
        worker = threading.Thread(target=queued_set_write)
        worker.start()
        deadline = time.monotonic() + 1.5
        while a.run(f"select cardinality(pg_blocking_pids({backend_set_writer}))>0;")[-1] != 't':
            assert time.monotonic() < deadline, 'Set writer did not wait behind Trash'
            time.sleep(0.01)
        a.run('commit;')
        worker.join(timeout=5)
        assert not worker.is_alive(), 'Set writer did not finish after Trash COMMIT'
        outcome = result.get(timeout=1)
        if isinstance(outcome, Exception):
            raise outcome
        if mode == 'insert':
            assert a.run(f"select count(*) from public.cardforge_contributor_asset_submissions where id='{consumer}';")[-1] == '0'
        else:
            assert a.run(f"select preview_url='' from public.cardforge_contributor_asset_submissions where id='{consumer}';")[-1] == 't'
            a.run(f"delete from public.cardforge_contributor_asset_submissions where id='{consumer}';")
        print('PASS: Trash COMMIT then queued Set ' + mode.upper() + ' rejects dependency')

    # Kind-only changes must not use an unchanged URL/pointer fast path.
    media = str(uuid.uuid4())
    a.run(f"insert into public.cardforge_contributor_asset_submissions(id,contributor_id,asset_type,name,status,revision_number) values('{media}','isolated-contention','icons','Kind proof','submitted',1);")
    a.run(f"do $$ begin begin update public.cardforge_contributor_asset_submissions set asset_type='sets' where id='{media}'; raise exception 'submission_kind_bypass'; exception when raise_exception then if sqlerrm<>'set_catalog_dependency_unverified' then raise; end if; end; end $$;")
    a.run(f"delete from public.cardforge_contributor_asset_submissions where id='{media}';")
    media_asset = 'kind-proof-' + media
    a.run(f"insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source) values('{media_asset}','Kind proof','icon','https://example.invalid/unrelated.svg','published','free','contributor');")
    a.run(f"do $$ begin begin update public.cardforge_asset_registry set asset_type='set' where asset_id='{media_asset}'; raise exception 'registry_kind_bypass'; exception when raise_exception then if sqlerrm<>'set_catalog_dependency_unverified' then raise; end if; end; end $$;")
    a.run(f"delete from public.cardforge_asset_registry where asset_id='{media_asset}';")
    print('PASS: kind-only transitions cannot bypass committed Trash inspection')

    consumer = str(uuid.uuid4())
    b.run('begin isolation level repeatable read;')
    b.run('select count(*) from public.cardforge_pipeline_asset_lineages;')
    statement = set_insert('set-old-snapshot-' + consumer, consumer)
    b.run("do $$ begin begin " + statement + "; raise exception 'set_snapshot_admitted'; exception when raise_exception then if sqlerrm<>'set_catalog_isolation_unsupported' then raise; end if; end; end $$;")
    b.run('rollback;')
    print('PASS: Set write rejects unsupported repeatable snapshot')

    # Studio source-owned interpretation uses native digest/revision binding.
    # Run this group before creating unrelated destructive claims below.
    literal = {"version": 1, "userTemplates": [{"id": "literal", "name": "Literal", "aspectRatio": "2:3",
        "freeformCanvas": {"width": 300, "height": 450, "elements": []}}], "storedCards": [], "cardSets": []}
    def studio_values(payload):
        # Synthetic trusted descriptor for a fully literal template; production
        # interpretation is covered separately through its TypeScript owner.
        proof = {"contractVersion": 1, "complete": True, "references": {"identities": [payload['userTemplates'][0]['id']], "sources": []},
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

    # A stale repeatable snapshot is not the supported server write boundary.
    # Prove the explicit isolation fence after the other session commits Trash.
    lineage, current, old, state = fixture(a)
    document = str(uuid.uuid4())
    payload, proof = studio_values(literal)
    b.run('begin isolation level repeatable read;')
    b.run('select count(*) from public.cardforge_pipeline_asset_lineages;')
    a.run('select ' + command('trash', state) + ';')
    b.run(f"do $$ begin begin insert into public.cardforge_studio_documents(id,owner_user_id,title,document_payload,catalog_dependencies) values('{document}','isolated-contention','Stale snapshot',{payload},{proof}); raise exception 'stale_snapshot_writer_admitted'; exception when raise_exception then if sqlerrm<>'studio_catalog_isolation_unsupported' then raise; end if; end; end $$;")
    b.run('rollback;')
    print('PASS: repeatable snapshot cannot certify absence of committed Trash')

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


    # New authored raster dependency uses the original upload receipt and the
    # same guarded lineage/registry lock boundary as catalog Trash.
    raster_desc = {"assetType":"imageAssets","fileName":"proof.png","fileSizeBytes":100,
                   "mimeType":"image/png","transportExtension":"png"}
    raster_desc_json = json.dumps(raster_desc)
    reservation = json.loads(a.run("select public.cardforge_reserve_pipeline_upload('raster-owner','"
                                   + raster_desc_json + "'::jsonb)::text;")[-1])
    raster_path = reservation['storagePath']
    raster_lineage = reservation['lineageId']
    raster_asset = 'native-raster-' + uuid.uuid4().hex
    source_hash = 'a' * 64
    webp_hash = 'b' * 64
    raster_request = {
        "contributor_id":"raster-owner","asset_type":"imageAssets","name":"Raster contention",
        "source_storage_bucket":"cardforge-contributor-assets","source_storage_path":raster_path,
        "source_url":"https://example.invalid/storage/v1/object/public/cardforge-contributor-assets/" + raster_path,
        "preview_url":"https://example.invalid/storage/v1/object/public/cardforge-contributor-assets/" + raster_path,
        "source_mime_type":"image/png","source_file_size_bytes":100,
        "source_content_sha256":source_hash
    }
    raster_request_json = json.dumps(raster_request)
    prepared = json.loads(a.run("select public.cardforge_prepare_pipeline_upload_submission('raster-owner','"
                                  + raster_path + "','" + raster_desc_json + "'::jsonb,'"
                                  + raster_request_json + "'::jsonb,true)::text;")[-1])
    raster_token = prepared['token']
    raster_submission = a.run("select public.cardforge_commit_pipeline_upload_submission('"
                              + raster_path + "','" + raster_token + "','" + raster_request_json + "'::jsonb);")[-1]
    a.run(f"update public.cardforge_pipeline_asset_lineages set registry_asset_id='{raster_asset}',revision_high_water=1 where id='{raster_lineage}';")
    a.run("insert into public.cardforge_asset_registry(asset_id,name,asset_type,url,status,access_tier,library_source,contributor_submission_id)"
          + f" values('{raster_asset}','Native raster','image','{raster_request['source_url']}','published','free','contributor','{raster_submission}');")
    a.run("update public.cardforge_contributor_asset_submissions set status='published',"
          + " editorial_review_status='approved',published_at=now(),revision_number=1,"
          + f" registry_asset_id='{raster_asset}',target_registry_asset_id='{raster_asset}' where id='{raster_submission}';")
    a.run("insert into public.cardforge_pipeline_template_assets(asset_id,storage_bucket,storage_path,mime_type,byte_count)"
          + f" values('{webp_hash}','cardforge-developer-assets','template-assets/{webp_hash}.webp','image/webp',100) on conflict do nothing;")
    adopter = 'native-adopter-' + uuid.uuid4().hex
    payload = {"id":adopter,"name":"Raster adopter","aspectRatio":"63:88","freeformCanvas":{
        "width":630,"height":880,"elements":[{"id":"art","name":"Art","type":"image","x":0,"y":0,
                                      "width":200,"height":200,"zIndex":0,
                                      "imageSource":"cardforge-pipeline-asset://" + webp_hash}]}}
    binding = {"assetId":raster_asset,"submissionId":raster_submission,"elementId":"art",
               "originalSha256":source_hash,"normalizedSha256":webp_hash}
    wrapped = ("public.cardforge_author_template_managed_raster('draft','" + adopter
               + "','Raster adopter','','raster-owner',null,'" + json.dumps(payload)
               + "'::jsonb,0,'raster-race-key','" + json.dumps(binding) + "'::jsonb)")
    a.run('begin;')
    a.run(f"select 1 from public.cardforge_pipeline_asset_lineages where id='{raster_lineage}' for update;")
    expect_busy(b, wrapped)
    a.run('rollback;')
    adopted_id = b.run("select " + wrapped + ";")[-1]
    assert len(adopted_id) == 36
    reasons = b.run(f"select array_to_string(public.cardforge_catalog_trash_entry_reasons('{raster_lineage}'),',');")[-1]
    assert 'pipeline_identity_consumer_requires_resolution' in reasons, reasons
    print('PASS: native raster adoption loses locked-lineage race; committed exact dependency fences catalog Trash')

finally:
    a.close()
    b.close()
