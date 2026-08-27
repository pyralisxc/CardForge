import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BUCKET = 'cardforge-developer-assets';
const REFERENCE_PREFIX = 'cardforge-pipeline-asset://';
const STORAGE_PREFIX = 'template-assets';
const TRANSPARENT_PREVIEW_SENTINEL = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const MAX_SOURCE_BYTES = 2_400_000;
const MAX_SOURCE_DIMENSION = 8192;
const NORMALIZED_MAX_DIMENSION = 2400;

const parseEnvFile = async () => {
  const contents = await fs.readFile(path.join(process.cwd(), '.env.local'), 'utf8').catch(() => '');
  return Object.fromEntries(contents
    .split(/\r?\n/u)
    .filter((line) => /^\w+=/u.test(line))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/gu, '')];
    }));
};

const parseArguments = () => {
  const values = process.argv.slice(2);
  const apply = values.includes('--apply');
  const projectRefValue = values.find((value) => value.startsWith('--project-ref='));
  return {
    apply,
    projectRef: projectRefValue?.slice('--project-ref='.length) ?? null,
  };
};

const parseDataImage = (value) => {
  if (value === TRANSPARENT_PREVIEW_SENTINEL) return Buffer.alloc(0);
  if (!value.startsWith('data:image/')) return null;
  const commaIndex = value.indexOf(',');
  if (commaIndex < 0) throw new Error('Found an invalid image data URI.');
  const metadata = value.slice(5, commaIndex).split(';');
  const mimeType = metadata[0]?.toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(mimeType)) {
    throw new Error(`Unsupported embedded Template media type: ${mimeType || 'unknown'}.`);
  }
  const payload = value.slice(commaIndex + 1);
  const bytes = metadata.some((entry) => entry.toLowerCase() === 'base64')
    ? Buffer.from(payload.replace(/\s+/gu, ''), 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');
  if (bytes.length <= 0 || bytes.length > MAX_SOURCE_BYTES) {
    throw new Error('Embedded Template media exceeds the 2.4 MB migration limit.');
  }
  return bytes;
};

const normalize = async (source) => {
  const metadata = await sharp(source, { failOn: 'error', animated: false }).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Embedded Template media has no dimensions.');
  if (metadata.width > MAX_SOURCE_DIMENSION || metadata.height > MAX_SOURCE_DIMENSION) {
    throw new Error(`Embedded Template media exceeds ${MAX_SOURCE_DIMENSION}px.`);
  }
  return sharp(source, { failOn: 'error', animated: false })
    .rotate()
    .resize({
      width: NORMALIZED_MAX_DIMENSION,
      height: NORMALIZED_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toBuffer();
};

const externalize = async (value, storeAsset) => {
  if (typeof value === 'string') {
    const source = parseDataImage(value);
    if (source === null) return value;
    if (source.length === 0) return '';
    return storeAsset(await normalize(source));
  }
  if (Array.isArray(value)) return Promise.all(value.map((entry) => externalize(entry, storeAsset)));
  if (value && typeof value === 'object') {
    return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, entry]) => (
      [key, await externalize(entry, storeAsset)]
    ))));
  }
  return value;
};

const containsEmbeddedImage = (value) => JSON.stringify(value).includes('data:image/');

const main = async () => {
  const args = parseArguments();
  const envFile = await parseEnvFile();
  const supabaseUrl = process.env.SUPABASE_URL || envFile.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
    || envFile.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || envFile.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseSecretKey) throw new Error('SUPABASE_URL and a server secret are required.');
  const actualProjectRef = new URL(supabaseUrl).hostname.split('.')[0];
  if (args.apply && args.projectRef !== actualProjectRef) {
    throw new Error(`Refusing mutation. Re-run with --apply --project-ref=${actualProjectRef}.`);
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: rows, error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('id,source_payload,source_file_size_bytes')
    .eq('asset_type', 'templates')
    .not('source_payload', 'is', null);
  if (error) throw error;

  const candidates = (rows ?? []).filter((row) => containsEmbeddedImage(row.source_payload));
  process.stdout.write(`${args.apply ? 'Applying' : 'Dry run'} ${actualProjectRef}: ${candidates.length} Template revision(s) contain embedded media.\n`);
  if (!args.apply) return;

  const storage = supabase.storage.from(BUCKET);
  const pending = new Map();
  const storeAsset = async (bytes) => {
    const assetId = createHash('sha256').update(bytes).digest('hex');
    let pendingAsset = pending.get(assetId);
    if (!pendingAsset) {
      pendingAsset = (async () => {
        const storagePath = `${STORAGE_PREFIX}/${assetId}.webp`;
        const existing = await storage.exists(storagePath);
        if (existing.error && existing.data !== false) throw existing.error;
        if (!existing.data) {
          const uploaded = await storage.upload(storagePath, bytes, {
            contentType: 'image/webp',
            cacheControl: '31536000',
            upsert: false,
          });
          if (uploaded.error) {
            const raced = await storage.exists(storagePath);
            if (!raced.data) throw uploaded.error;
          }
        }
        const recorded = await supabase.from('cardforge_pipeline_template_assets').upsert({
          asset_id: assetId,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          mime_type: 'image/webp',
          byte_count: bytes.byteLength,
        }, { onConflict: 'asset_id' });
        if (recorded.error) throw recorded.error;
        return `${REFERENCE_PREFIX}${assetId}`;
      })();
      pending.set(assetId, pendingAsset);
    }
    return pendingAsset;
  };

  for (const row of candidates) {
    const payload = await externalize(row.source_payload, storeAsset);
    if (containsEmbeddedImage(payload)) throw new Error(`Submission ${row.id} still contains embedded media.`);
    const updated = await supabase.from('cardforge_developer_asset_submissions').update({
      source_payload: payload,
      source_file_size_bytes: Buffer.byteLength(JSON.stringify(payload)),
    }).eq('id', row.id);
    if (updated.error) throw updated.error;

    const registryResult = await supabase.from('cardforge_asset_registry')
      .select('asset_id,metadata')
      .eq('developer_submission_id', row.id)
      .maybeSingle();
    if (registryResult.error) throw registryResult.error;
    const registryMetadata = registryResult.data?.metadata;
    if (
      registryResult.data?.asset_id
      && registryMetadata
      && typeof registryMetadata === 'object'
      && !Array.isArray(registryMetadata)
      && Object.hasOwn(registryMetadata, 'template')
    ) {
      const registryUpdate = await supabase.from('cardforge_asset_registry').update({
        metadata: { ...registryMetadata, template: payload },
      }).eq('asset_id', registryResult.data.asset_id);
      if (registryUpdate.error) throw registryUpdate.error;
    }
  }

  const { data: remaining, error: remainingError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('id,source_payload')
    .eq('asset_type', 'templates')
    .not('source_payload', 'is', null);
  if (remainingError) throw remainingError;
  const remainingIds = (remaining ?? []).filter((row) => containsEmbeddedImage(row.source_payload)).map((row) => row.id);
  if (remainingIds.length > 0) throw new Error(`Embedded media remains on submissions: ${remainingIds.join(', ')}`);
  process.stdout.write(`Migrated ${candidates.length} revision(s) to ${pending.size} content-addressed asset(s); zero embedded images remain.\n`);
};

main().catch((error) => {
  const message = error instanceof Error
    ? error.message
    : JSON.stringify(error, null, 2);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
