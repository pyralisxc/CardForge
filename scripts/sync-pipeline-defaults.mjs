import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

let OWNER_EMAIL = process.env.CARDFORGE_PIPELINE_OWNER_EMAIL?.trim() || null;
const ASSET_BUCKET = process.env.CARDFORGE_DEVELOPER_ASSET_BUCKET || 'cardforge-developer-assets';

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, '.env.local');

const parseEnvFile = async () => {
  const contents = await fs.readFile(envPath, 'utf8').catch(() => '');
  const entries = contents
    .split(/\r?\n/)
    .filter((line) => /^\w+=/.test(line))
    .map((line) => {
      const index = line.indexOf('=');
      const key = line.slice(0, index);
      const value = line.slice(index + 1).replace(/^"|"$/g, '');
      return [key, value];
    });
  return Object.fromEntries(entries);
};

const toTitleCase = (value) => value
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/\b\w/g, (match) => match.toUpperCase());

const slugifyAssetId = (value) => value
  .toLowerCase()
  .replace(/[^a-z0-9/_-]+/g, '-')
  .replace(/\\/g, '/')
  .replace(/\//g, '-')
  .replace(/^-+|-+$/g, '');

const mimeByExtension = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
};

const developerTypeByRegistryType = {
  texture: 'textures',
  divider: 'dividers',
  part: 'parts',
  icon: 'icons',
  image: 'imageAssets',
  template: 'templates',
  elementPreset: 'elementPresets',
};

const registryTypeByFolder = {
  textures: 'texture',
  dividers: 'divider',
  parts: 'part',
  icons: 'icon',
  images: 'image',
};

const walkFiles = async (directory, baseDirectory = directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath, baseDirectory));
    } else if (entry.isFile()) {
      files.push(path.relative(baseDirectory, fullPath).replace(/\\/g, '/'));
    }
  }
  return files;
};

const readJson = async (filePath) => {
  const contents = await fs.readFile(filePath, 'utf8');
  return JSON.parse(contents);
};

const readMetadata = async (kindFolder, relativePath) => {
  const metadataPath = path.join(
    projectRoot,
    'data',
    'assets',
    kindFolder,
    relativePath.replace(/\.[^.]+$/, '.json'),
  );
  return readJson(metadataPath).catch(() => ({}));
};

const defaultAssetMetadata = (registryType, relativePath) => {
  const stem = relativePath.replace(/\.[^.]+$/, '');
  const fileStem = stem.split('/').pop() || stem;
  const id = slugifyAssetId(stem);
  const packId = stem.includes('/') ? stem.split('/')[0] : undefined;
  const packName = packId ? toTitleCase(packId) : undefined;

  const base = {
    id,
    name: toTitleCase(fileStem),
    packId,
    packName,
    defaultBlendMode: 'normal',
    defaultOpacity: 100,
    defaultScale: 100,
  };

  if (registryType === 'texture') {
    return {
      ...base,
      tileMode: 'repeat',
      seamless: true,
      allowedTargets: ['text', 'shape', 'template'],
      defaultBlendMode: 'multiply',
      defaultOpacity: 42,
      defaultScale: 160,
    };
  }

  if (registryType === 'divider') {
    return {
      ...base,
      tileMode: 'stretch',
      seamless: false,
      allowedTargets: ['divider'],
    };
  }

  if (registryType === 'icon') {
    return {
      ...base,
      tileMode: 'contain',
      seamless: false,
      allowedTargets: ['icon'],
      defaultWidth: 64,
      defaultHeight: 64,
    };
  }

  if (registryType === 'image') {
    return {
      ...base,
      tileMode: 'contain',
      seamless: false,
      allowedTargets: ['image', 'imageFrame', 'template'],
      defaultWidth: 300,
      defaultHeight: 180,
    };
  }

  return {
    ...base,
    tileMode: 'contain',
    seamless: false,
    allowedTargets: ['imageFrame', 'shape', 'template'],
    partRole: 'ornament',
    defaultWidth: 220,
    defaultHeight: 120,
  };
};

const upsertRegistryItem = async (supabase, item, ownerProfile) => {
  const { error } = await supabase.rpc('cardforge_upsert_pipeline_registry_asset', {
    p_asset_id: item.asset_id,
    p_name: item.name,
    p_submission_asset_type: item.developer_asset_type,
    p_registry_asset_type: item.registry_asset_type,
    p_url: item.url,
    p_preview_url: item.preview_url,
    p_description: item.description,
    p_developer_id: ownerProfile.clerk_user_id,
    p_developer_email: ownerProfile.email,
    p_file_size_bytes: item.file_size_bytes,
    p_source_mime_type: item.source_mime_type,
    p_storage_bucket: item.storage_bucket,
    p_storage_path: item.storage_path,
    p_metadata: item.metadata,
  });
  if (error) throw error;
};

const uploadStaticAsset = async (supabase, kindFolder, relativePath) => {
  const absolutePath = path.join(projectRoot, 'public', 'card-assets', kindFolder, relativePath);
  const extension = path.extname(relativePath).toLowerCase();
  const storagePath = `owner-defaults/${kindFolder}/${relativePath}`;
  const body = await fs.readFile(absolutePath);
  const { error } = await supabase.storage
    .from(ASSET_BUCKET)
    .upload(storagePath, body, {
      contentType: mimeByExtension[extension] || 'application/octet-stream',
      upsert: true,
    });
  if (error) throw error;
  const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(storagePath);
  return {
    publicUrl: data.publicUrl,
    storagePath,
    fileSizeBytes: body.byteLength,
    mimeType: mimeByExtension[extension] || 'application/octet-stream',
  };
};

const collectStaticAssetItems = async (supabase) => {
  const items = [];
  for (const [kindFolder, registryType] of Object.entries(registryTypeByFolder)) {
    const directory = path.join(projectRoot, 'public', 'card-assets', kindFolder);
    const files = (await walkFiles(directory))
      .filter((file) => ['.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(file).toLowerCase()));

    for (const relativePath of files) {
      const defaults = defaultAssetMetadata(registryType, relativePath);
      const sidecar = await readMetadata(kindFolder, relativePath);
      const metadata = {
        ...defaults,
        ...sidecar,
        sourceKind: 'pipeline-owner-import',
        sourcePath: `public/card-assets/${kindFolder}/${relativePath}`,
      };
      const uploaded = await uploadStaticAsset(supabase, kindFolder, relativePath);
      items.push({
        asset_id: metadata.id,
        name: metadata.name,
        registry_asset_type: registryType,
        developer_asset_type: developerTypeByRegistryType[registryType],
        url: uploaded.publicUrl,
        preview_url: uploaded.publicUrl,
        storage_bucket: ASSET_BUCKET,
        storage_path: uploaded.storagePath,
        file_size_bytes: uploaded.fileSizeBytes,
        source_mime_type: uploaded.mimeType,
        description: `${metadata.name} starter ${registryType} imported into the Forge Pipeline.`,
        metadata,
      });
    }
  }
  return items;
};

const collectTemplateItems = async () => {
  const directory = path.join(projectRoot, 'data', 'default-templates');
  const files = (await walkFiles(directory)).filter((file) => file.endsWith('.json'));
  const items = [];
  for (const file of files) {
    const template = await readJson(path.join(directory, file));
    if (!template?.id || !template?.name) continue;
    items.push({
      asset_id: template.id,
      name: template.name,
      registry_asset_type: 'template',
      developer_asset_type: 'templates',
      url: `/api/templates#${template.id}`,
      preview_url: `/api/templates#${template.id}`,
      storage_bucket: null,
      storage_path: null,
      file_size_bytes: Buffer.byteLength(JSON.stringify(template)),
      source_mime_type: 'application/json',
      description: template.templateDescription || `${template.name} starter template imported into the Forge Pipeline.`,
      metadata: {
        sourceKind: 'pipeline-owner-import',
        sourcePath: `data/default-templates/${file}`,
        template: {
          ...template,
          templateSource: 'default',
          templateLibrarySource: 'pipeline',
          templateAccessTier: 'free',
          templateRegistryStatus: 'published',
          templateContributorName: OWNER_EMAIL,
        },
      },
    });
  }
  return items;
};

const collectStyleItems = async () => {
  const directory = path.join(projectRoot, 'data', 'styles');
  const files = (await walkFiles(directory)).filter((file) => file.endsWith('.json'));
  const items = [];
  for (const file of files) {
    const document = await readJson(path.join(directory, file));
    const styles = Array.isArray(document?.styles) ? document.styles : [document];
    for (const style of styles) {
      if (!style?.id || !style?.name) continue;
      items.push({
        asset_id: style.id,
        name: style.name,
        registry_asset_type: 'elementPreset',
        developer_asset_type: 'elementPresets',
        url: `/api/styles#${style.id}`,
        preview_url: `/api/styles#${style.id}`,
        storage_bucket: null,
        storage_path: null,
        file_size_bytes: Buffer.byteLength(JSON.stringify(style)),
        source_mime_type: 'application/json',
        description: `${style.name} starter style imported into the Forge Pipeline.`,
        metadata: {
          sourceKind: 'pipeline-owner-import',
          sourcePath: `data/styles/${file}`,
          style: {
            ...style,
            librarySource: 'developer',
            accessTier: 'free',
            registryStatus: 'published',
            contributorName: OWNER_EMAIL,
          },
        },
      });
    }
  }
  return items;
};

const main = async () => {
  const envFile = await parseEnvFile();
  OWNER_EMAIL = OWNER_EMAIL || envFile.CARDFORGE_PIPELINE_OWNER_EMAIL?.trim() || null;
  const supabaseUrl = process.env.SUPABASE_URL || envFile.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envFile.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  if (!OWNER_EMAIL) {
    throw new Error('CARDFORGE_PIPELINE_OWNER_EMAIL is required.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: ownerProfiles, error: ownerError } = await supabase
    .from('cardforge_developer_profiles')
    .select('clerk_user_id,email,first_name,last_name')
    .eq('email', OWNER_EMAIL)
    .limit(1);
  if (ownerError) throw ownerError;

  const ownerProfile = ownerProfiles?.[0] || { clerk_user_id: OWNER_EMAIL, email: OWNER_EMAIL };
  const { error: profileSyncError } = await supabase
    .from('cardforge_developer_profiles')
    .upsert({
      clerk_user_id: ownerProfile.clerk_user_id,
      email: OWNER_EMAIL,
      status: 'active',
      eligible_for_profit_share: true,
    }, { onConflict: 'clerk_user_id' });
  if (profileSyncError) throw profileSyncError;

  const items = [
    ...await collectStaticAssetItems(supabase),
    ...await collectTemplateItems(),
    ...await collectStyleItems(),
  ];

  for (const item of items) {
    await upsertRegistryItem(supabase, item, { ...ownerProfile, email: OWNER_EMAIL });
    console.log(`Synced ${item.registry_asset_type}: ${item.name}`);
  }

  console.log(`Synced ${items.length} starter entries into the Forge Pipeline as ${OWNER_EMAIL}.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
