import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

const firstOwnerEmail = (value) => value
  ?.split(',')
  .map((email) => email.trim().toLowerCase())
  .find(Boolean) || null;

let OWNER_EMAIL = firstOwnerEmail(process.env.CARDFORGE_OWNER_ACCOUNT_EMAILS);
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

const rewritePipelineAssetUrls = (value, publicUrlByLocalPath) => {
  if (typeof value === 'string') return publicUrlByLocalPath.get(value) || value;
  if (Array.isArray(value)) return value.map((entry) => rewritePipelineAssetUrls(entry, publicUrlByLocalPath));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    rewritePipelineAssetUrls(entry, publicUrlByLocalPath),
  ]));
};

const collectPipelineAssetPaths = (value, paths = new Set()) => {
  if (typeof value === 'string') {
    if (value.startsWith('/card-assets/')) paths.add(value.slice('/card-assets/'.length));
    return paths;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectPipelineAssetPaths(entry, paths));
    return paths;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectPipelineAssetPaths(entry, paths));
  }
  return paths;
};

const containsRepositoryAssetUrl = (value) => {
  if (typeof value === 'string') return value.startsWith('/card-assets/');
  if (Array.isArray(value)) return value.some(containsRepositoryAssetUrl);
  return Boolean(value && typeof value === 'object' && Object.values(value).some(containsRepositoryAssetUrl));
};

const getStaticAssetDescriptor = (relativePath) => {
  const [rootFolder, ...rest] = relativePath.split('/');
  const registryType = registryTypeByFolder[rootFolder] || 'image';
  const metadataRelativePath = registryTypeByFolder[rootFolder]
    ? rest.join('/')
    : relativePath;
  return {
    kindFolder: registryTypeByFolder[rootFolder] ? rootFolder : null,
    registryType,
    metadataRelativePath,
    defaults: defaultAssetMetadata(registryType, metadataRelativePath),
  };
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

const uploadStaticAsset = async (supabase, relativePath) => {
  const absolutePath = path.join(projectRoot, 'public', 'card-assets', relativePath);
  const extension = path.extname(relativePath).toLowerCase();
  const storagePath = `owner-defaults/${relativePath}`;
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
    storageBucket: ASSET_BUCKET,
    storagePath,
    fileSizeBytes: body.byteLength,
    mimeType: mimeByExtension[extension] || 'application/octet-stream',
  };
};

const collectReferencedAssetPaths = async () => {
  const paths = new Set();
  for (const directory of [
    path.join(projectRoot, 'data', 'default-templates'),
    path.join(projectRoot, 'data', 'styles'),
  ]) {
    const files = (await walkFiles(directory)).filter((file) => file.endsWith('.json'));
    for (const file of files) {
      collectPipelineAssetPaths(await readJson(path.join(directory, file)), paths);
    }
  }
  return paths;
};

const collectStaticAssetItems = async (
  supabase,
  existingRegistryByAssetId,
  tombstonedAssetIds,
  referencedAssetPaths,
) => {
  const publicUrlByLocalPath = new Map();
  const rootDirectory = path.join(projectRoot, 'public', 'card-assets');
  const availableFiles = (await walkFiles(rootDirectory))
    .filter((file) => ['.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(file).toLowerCase()));
  const catalogFolders = new Set(Object.keys(registryTypeByFolder));
  const sourceFiles = availableFiles.filter((file) => (
    catalogFolders.has(file.split('/')[0]) || referencedAssetPaths.has(file)
  ));
  const uploadedByRelativePath = new Map();
  const storageMigrationRelativePaths = new Set();
  for (const relativePath of sourceFiles) {
    const descriptor = getStaticAssetDescriptor(relativePath);
    const assetId = descriptor.defaults.id;
    if (tombstonedAssetIds.has(assetId)) continue;
    const existing = existingRegistryByAssetId.get(assetId);
    const localUrl = `/card-assets/${relativePath}`;
    const hasManagedStorage = Boolean(existing?.storage_bucket && existing?.storage_path);
    if (existing && existing.url !== localUrl) {
      publicUrlByLocalPath.set(`/card-assets/${relativePath}`, existing.url);
      continue;
    }
    if (existing && hasManagedStorage) {
      const { data } = supabase.storage
        .from(existing.storage_bucket)
        .getPublicUrl(existing.storage_path);
      publicUrlByLocalPath.set(localUrl, data.publicUrl);
      storageMigrationRelativePaths.add(relativePath);
      continue;
    }
    const uploaded = await uploadStaticAsset(supabase, relativePath);
    uploadedByRelativePath.set(relativePath, uploaded);
    publicUrlByLocalPath.set(localUrl, uploaded.publicUrl);
    if (existing) storageMigrationRelativePaths.add(relativePath);
  }

  const items = [];
  for (const relativePath of sourceFiles) {
    const descriptor = getStaticAssetDescriptor(relativePath);
    if (tombstonedAssetIds.has(descriptor.defaults.id)) continue;
    const sidecar = descriptor.kindFolder
      ? await readMetadata(descriptor.kindFolder, descriptor.metadataRelativePath)
      : {};
    const metadata = {
      ...descriptor.defaults,
      ...sidecar,
      sourceKind: 'pipeline-owner-import',
      sourcePath: `public/card-assets/${relativePath}`,
    };
    const existing = existingRegistryByAssetId.get(metadata.id);
    const uploaded = uploadedByRelativePath.get(relativePath);
    const storagePath = uploaded?.storagePath || existing?.storage_path || `owner-defaults/${relativePath}`;
    const extension = path.extname(relativePath).toLowerCase();
    items.push({
      asset_id: metadata.id,
      name: metadata.name,
      registry_asset_type: descriptor.registryType,
      developer_asset_type: developerTypeByRegistryType[descriptor.registryType],
      url: publicUrlByLocalPath.get(`/card-assets/${relativePath}`),
      preview_url: publicUrlByLocalPath.get(`/card-assets/${relativePath}`),
      storage_bucket: uploaded?.storageBucket || existing?.storage_bucket || ASSET_BUCKET,
      storage_path: storagePath,
      file_size_bytes: uploaded?.fileSizeBytes || existing?.file_size_bytes || 0,
      source_mime_type: uploaded?.mimeType || mimeByExtension[extension] || 'application/octet-stream',
      description: `${metadata.name} starter ${descriptor.registryType} imported into the Forge Pipeline.`,
      metadata,
      requires_storage_migration: storageMigrationRelativePaths.has(relativePath),
      expected_repository_url: `/card-assets/${relativePath}`,
    });
  }
  return { items, publicUrlByLocalPath };
};

const collectTemplateItems = async (publicUrlByLocalPath) => {
  const directory = path.join(projectRoot, 'data', 'default-templates');
  const files = (await walkFiles(directory)).filter((file) => file.endsWith('.json'));
  const items = [];
  for (const file of files) {
    const template = rewritePipelineAssetUrls(
      await readJson(path.join(directory, file)),
      publicUrlByLocalPath,
    );
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
          templateContributorName: 'CardForge Studio',
        },
      },
    });
  }
  return items;
};

const collectStyleItems = async (publicUrlByLocalPath) => {
  const directory = path.join(projectRoot, 'data', 'styles');
  const files = (await walkFiles(directory)).filter((file) => file.endsWith('.json'));
  const items = [];
  for (const file of files) {
    const document = rewritePipelineAssetUrls(
      await readJson(path.join(directory, file)),
      publicUrlByLocalPath,
    );
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
            contributorName: 'CardForge Studio',
          },
        },
      });
    }
  }
  return items;
};

const main = async () => {
  const envFile = await parseEnvFile();
  OWNER_EMAIL = OWNER_EMAIL
    || firstOwnerEmail(envFile.CARDFORGE_OWNER_ACCOUNT_EMAILS);
  const supabaseUrl = process.env.SUPABASE_URL || envFile.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envFile.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  if (!OWNER_EMAIL) {
    const { data: ownerHistory, error: ownerHistoryError } = await supabase
      .from('cardforge_developer_asset_submissions')
      .select('developer_email')
      .eq('decision_reason', 'pipeline_owner_edit')
      .not('developer_email', 'is', null)
      .limit(100);
    if (ownerHistoryError) throw ownerHistoryError;
    const ownerEmails = [...new Set(
      (ownerHistory || [])
        .map((row) => row.developer_email?.trim().toLowerCase())
        .filter(Boolean),
    )];
    if (ownerEmails.length !== 1) {
      throw new Error(
        'Configure one CARDFORGE_OWNER_ACCOUNT_EMAILS identity; existing Pipeline ownership is absent or ambiguous.',
      );
    }
    [OWNER_EMAIL] = ownerEmails;
  }

  const { data: ownerProfiles, error: ownerError } = await supabase
    .from('cardforge_developer_profiles')
    .select('clerk_user_id,email,first_name,last_name')
    .eq('email', OWNER_EMAIL)
    .eq('status', 'active')
    .limit(1);
  if (ownerError) throw ownerError;

  const ownerProfile = ownerProfiles?.[0];
  if (!ownerProfile) {
    throw new Error('The configured owner identity must already have an active Forge Pipeline developer profile.');
  }

  const { data: existingRegistry, error: registryError } = await supabase
    .from('cardforge_asset_registry')
    .select('asset_id,url,storage_bucket,storage_path,file_size_bytes,metadata');
  if (registryError) throw registryError;
  const { data: tombstones, error: tombstoneError } = await supabase
    .from('cardforge_pipeline_asset_tombstones')
    .select('asset_id');
  if (tombstoneError) throw tombstoneError;

  const existingRegistryByAssetId = new Map(
    (existingRegistry || []).map((entry) => [entry.asset_id, entry]),
  );
  const tombstonedAssetIds = new Set((tombstones || []).map((entry) => entry.asset_id));
  const referencedAssetPaths = await collectReferencedAssetPaths();
  (existingRegistry || []).forEach((entry) => collectPipelineAssetPaths(entry.metadata, referencedAssetPaths));
  const staticCatalog = await collectStaticAssetItems(
    supabase,
    existingRegistryByAssetId,
    tombstonedAssetIds,
    referencedAssetPaths,
  );
  const items = [
    ...staticCatalog.items,
    ...await collectTemplateItems(staticCatalog.publicUrlByLocalPath),
    ...await collectStyleItems(staticCatalog.publicUrlByLocalPath),
  ];

  for (const item of staticCatalog.items.filter((entry) => entry.requires_storage_migration)) {
    const { error } = await supabase.rpc('cardforge_migrate_pipeline_registry_storage', {
      p_asset_id: item.asset_id,
      p_expected_url: item.expected_repository_url,
      p_url: item.url,
      p_storage_bucket: item.storage_bucket,
      p_storage_path: item.storage_path,
      p_file_size_bytes: item.file_size_bytes,
      p_source_mime_type: item.source_mime_type,
    });
    if (error) throw error;
    console.log(`Moved ${item.registry_asset_type} into managed Pipeline storage: ${item.name}`);
  }

  for (const entry of existingRegistry || []) {
    if (tombstonedAssetIds.has(entry.asset_id) || !containsRepositoryAssetUrl(entry.metadata)) continue;
    const metadata = rewritePipelineAssetUrls(entry.metadata, staticCatalog.publicUrlByLocalPath);
    if (containsRepositoryAssetUrl(metadata)) {
      throw new Error(`Cannot migrate ${entry.asset_id}: a referenced Studio asset is missing or permanently deleted.`);
    }
    const { error } = await supabase.rpc('cardforge_migrate_pipeline_registry_metadata_urls', {
      p_asset_id: entry.asset_id,
      p_metadata: metadata,
    });
    if (error) throw error;
    console.log(`Moved embedded Studio references into the Pipeline: ${entry.asset_id}`);
  }

  const newItems = items.filter((item) => (
    !existingRegistryByAssetId.has(item.asset_id) && !tombstonedAssetIds.has(item.asset_id)
  ));
  for (const item of newItems) {
    if (containsRepositoryAssetUrl(item.metadata)) {
      throw new Error(
        `Cannot import ${item.asset_id}: a referenced Studio asset is missing or permanently deleted.`,
      );
    }
    await upsertRegistryItem(supabase, item, { ...ownerProfile, email: OWNER_EMAIL });
    console.log(`Imported ${item.registry_asset_type}: ${item.name}`);
  }

  console.log(
    `Imported ${newItems.length} missing starter entries; preserved ${items.length - newItems.length} existing owner decisions.`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
