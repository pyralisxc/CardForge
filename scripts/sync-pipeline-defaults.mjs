import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

const configuredOwnerEmail = (value) => {
  const emails = [...new Set((value || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean))];
  if (emails.length > 1) {
    throw new Error('CARDFORGE_OWNER_ACCOUNT_EMAILS must contain exactly one Pipeline owner.');
  }
  return emails[0] || null;
};

let OWNER_EMAIL = null;
const ASSET_BUCKET = process.env.CARDFORGE_DEVELOPER_ASSET_BUCKET || 'cardforge-developer-assets';
const BOOTSTRAP_ROOT = path.join('data', 'pipeline-bootstrap');
const BOOTSTRAP_MEDIA_PREFIX = 'bootstrap-media://';
const SITE_FALLBACK_PREFIX = 'site-fallback://';
const LEGACY_PUBLIC_MEDIA_PREFIX = '/card-assets/';

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
  icon: 'icons',
  image: 'imageAssets',
  template: 'templates',
  elementPreset: 'elementPresets',
};

const registryTypeByFolder = {
  textures: 'texture',
  dividers: 'divider',
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
    if (value.startsWith(BOOTSTRAP_MEDIA_PREFIX)) paths.add(value.slice(BOOTSTRAP_MEDIA_PREFIX.length));
    if (value.startsWith(SITE_FALLBACK_PREFIX)) paths.add(`site-fallbacks/${value.slice(SITE_FALLBACK_PREFIX.length)}`);
    if (value.startsWith(LEGACY_PUBLIC_MEDIA_PREFIX)) paths.add(value.slice(LEGACY_PUBLIC_MEDIA_PREFIX.length));
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
  if (typeof value === 'string') {
    return value.startsWith(BOOTSTRAP_MEDIA_PREFIX)
      || value.startsWith(SITE_FALLBACK_PREFIX)
      || value.startsWith(LEGACY_PUBLIC_MEDIA_PREFIX);
  }
  if (Array.isArray(value)) return value.some(containsRepositoryAssetUrl);
  return Boolean(value && typeof value === 'object' && Object.values(value).some(containsRepositoryAssetUrl));
};

const getStaticAssetDescriptor = (relativePath) => {
  const isSiteFallback = relativePath.startsWith('site-fallbacks/');
  const catalogPath = isSiteFallback
    ? relativePath.slice('site-fallbacks/'.length)
    : relativePath;
  const [rootFolder, ...rest] = catalogPath.split('/');
  const registryType = isSiteFallback ? 'image' : registryTypeByFolder[rootFolder];
  if (!registryType) {
    throw new Error(`Unsupported Pipeline media folder: ${rootFolder || '(empty)'}`);
  }
  const metadataRelativePath = registryTypeByFolder[rootFolder]
    ? rest.join('/')
    : catalogPath;
  return {
    kindFolder: registryTypeByFolder[rootFolder] ? rootFolder : null,
    registryType,
    metadataRelativePath,
    catalogPath,
    defaults: defaultAssetMetadata(registryType, metadataRelativePath),
  };
};

const readMetadata = async (kindFolder, relativePath) => {
  const metadataPath = path.join(
    projectRoot,
    BOOTSTRAP_ROOT,
    'metadata',
    kindFolder,
    relativePath.replace(/\.[^.]+$/, '.json'),
  );
  return readJson(metadataPath).catch(() => ({}));
};

const normalizeRepositoryPathAliases = (value) => (
  Array.isArray(value)
    ? [...new Set(value.filter((entry) => (
        typeof entry === 'string'
        && /^(?:textures|parts|dividers|icons|images)\//.test(entry)
        && !entry.includes('..')
      )))]
    : []
);

const repositoryOwnedSourcePaths = (metadata) => {
  if (metadata?.sourceKind !== 'pipeline-owner-import' || typeof metadata.sourcePath !== 'string') {
    return new Set();
  }
  const mediaPrefix = `${BOOTSTRAP_ROOT.replace(/\\/g, '/')}/media/`;
  if (!metadata.sourcePath.startsWith(mediaPrefix)) return new Set();
  const canonicalRelativePath = metadata.sourcePath.slice(mediaPrefix.length);
  const relativePaths = [
    canonicalRelativePath,
    ...normalizeRepositoryPathAliases(metadata.repositoryPathAliases),
  ];
  return new Set(relativePaths.flatMap((relativePath) => [
    `${mediaPrefix}${relativePath}`,
    `public/card-assets/${relativePath}`,
  ]));
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

  throw new Error(`Unsupported Pipeline media type: ${registryType}`);
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
  const absolutePath = relativePath.startsWith('site-fallbacks/')
    ? path.join(projectRoot, 'public', relativePath)
    : path.join(projectRoot, BOOTSTRAP_ROOT, 'media', relativePath);
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
    path.join(projectRoot, BOOTSTRAP_ROOT, 'templates'),
    path.join(projectRoot, BOOTSTRAP_ROOT, 'recipes'),
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
  const rootDirectory = path.join(projectRoot, BOOTSTRAP_ROOT, 'media');
  const availableFiles = (await walkFiles(rootDirectory))
    .filter((file) => ['.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(file).toLowerCase()));
  const fallbackFiles = (await walkFiles(path.join(projectRoot, 'public', 'site-fallbacks')))
    .filter((file) => ['.svg', '.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(file).toLowerCase()))
    .map((file) => `site-fallbacks/${file}`);
  const catalogFolders = new Set(Object.keys(registryTypeByFolder));
  const sourceFiles = [...availableFiles, ...fallbackFiles].filter((file) => (
    catalogFolders.has(file.split('/')[0]) || referencedAssetPaths.has(file)
  ));
  const uploadedByRelativePath = new Map();
  const storageMigrationRelativePaths = new Set();
  const expectedRepositoryUrlByRelativePath = new Map();
  const sidecarByRelativePath = new Map();
  for (const relativePath of sourceFiles) {
    const descriptor = getStaticAssetDescriptor(relativePath);
    const sidecar = descriptor.kindFolder
      ? await readMetadata(descriptor.kindFolder, descriptor.metadataRelativePath)
      : {};
    sidecarByRelativePath.set(relativePath, sidecar);
    const assetId = typeof sidecar.id === 'string' && sidecar.id.trim()
      ? sidecar.id.trim()
      : descriptor.defaults.id;
    if (tombstonedAssetIds.has(assetId)) continue;
    const existing = existingRegistryByAssetId.get(assetId);
    const localUrl = `${LEGACY_PUBLIC_MEDIA_PREFIX}${descriptor.catalogPath}`;
    const repositoryPathAliases = normalizeRepositoryPathAliases(sidecar.repositoryPathAliases);
    const repositoryUrlAliases = repositoryPathAliases.map((alias) => `${LEGACY_PUBLIC_MEDIA_PREFIX}${alias}`);
    const recognizedRepositoryUrls = new Set([localUrl, ...repositoryUrlAliases]);
    const seedUrl = relativePath.startsWith('site-fallbacks/')
      ? `${SITE_FALLBACK_PREFIX}${descriptor.catalogPath}`
      : `${BOOTSTRAP_MEDIA_PREFIX}${relativePath}`;
    const hasManagedStorage = Boolean(existing?.storage_bucket && existing?.storage_path);
    const registerResolvedUrl = (resolvedUrl) => {
      publicUrlByLocalPath.set(localUrl, resolvedUrl);
      publicUrlByLocalPath.set(seedUrl, resolvedUrl);
      for (const alias of repositoryPathAliases) {
        publicUrlByLocalPath.set(`${LEGACY_PUBLIC_MEDIA_PREFIX}${alias}`, resolvedUrl);
        publicUrlByLocalPath.set(`${BOOTSTRAP_MEDIA_PREFIX}${alias}`, resolvedUrl);
      }
    };
    if (existing && !recognizedRepositoryUrls.has(existing.url)) {
      registerResolvedUrl(existing.url);
      continue;
    }
    expectedRepositoryUrlByRelativePath.set(relativePath, existing?.url || localUrl);
    if (existing && hasManagedStorage) {
      const { data } = supabase.storage
        .from(existing.storage_bucket)
        .getPublicUrl(existing.storage_path);
      registerResolvedUrl(data.publicUrl);
      storageMigrationRelativePaths.add(relativePath);
      continue;
    }
    const uploaded = await uploadStaticAsset(supabase, relativePath);
    uploadedByRelativePath.set(relativePath, uploaded);
    registerResolvedUrl(uploaded.publicUrl);
    if (existing) storageMigrationRelativePaths.add(relativePath);
  }

  const items = [];
  for (const relativePath of sourceFiles) {
    const descriptor = getStaticAssetDescriptor(relativePath);
    const sidecar = sidecarByRelativePath.get(relativePath) || {};
    const assetId = typeof sidecar.id === 'string' && sidecar.id.trim()
      ? sidecar.id.trim()
      : descriptor.defaults.id;
    if (tombstonedAssetIds.has(assetId)) continue;
    const metadata = {
      ...descriptor.defaults,
      ...sidecar,
      sourceKind: 'pipeline-owner-import',
      sourcePath: relativePath.startsWith('site-fallbacks/')
        ? `public/${relativePath}`
        : `${BOOTSTRAP_ROOT.replace(/\\/g, '/')}/media/${relativePath}`,
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
      url: publicUrlByLocalPath.get(relativePath.startsWith('site-fallbacks/')
        ? `${SITE_FALLBACK_PREFIX}${descriptor.catalogPath}`
        : `${BOOTSTRAP_MEDIA_PREFIX}${relativePath}`),
      preview_url: publicUrlByLocalPath.get(relativePath.startsWith('site-fallbacks/')
        ? `${SITE_FALLBACK_PREFIX}${descriptor.catalogPath}`
        : `${BOOTSTRAP_MEDIA_PREFIX}${relativePath}`),
      storage_bucket: uploaded?.storageBucket || existing?.storage_bucket || ASSET_BUCKET,
      storage_path: storagePath,
      file_size_bytes: uploaded?.fileSizeBytes || existing?.file_size_bytes || 0,
      source_mime_type: uploaded?.mimeType || mimeByExtension[extension] || 'application/octet-stream',
      description: `${metadata.name} starter ${descriptor.registryType} imported into the Forge Pipeline.`,
      metadata,
      requires_storage_migration: storageMigrationRelativePaths.has(relativePath),
      expected_repository_url: expectedRepositoryUrlByRelativePath.get(relativePath)
        || `${LEGACY_PUBLIC_MEDIA_PREFIX}${descriptor.catalogPath}`,
    });
  }
  return { items, publicUrlByLocalPath };
};

const collectTemplateItems = async (publicUrlByLocalPath) => {
  const directory = path.join(projectRoot, BOOTSTRAP_ROOT, 'templates');
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
        sourcePath: `${BOOTSTRAP_ROOT.replace(/\\/g, '/')}/templates/${file}`,
        template: {
          ...template,
          templateSource: 'default',
          templateLibrarySource: 'pipeline',
          templateAccessTier: 'free',
          templateRegistryStatus: 'published',
          templateContributorName: 'Pyralis Cameron',
        },
      },
    });
  }
  return items;
};

const collectStyleItems = async (publicUrlByLocalPath) => {
  const directory = path.join(projectRoot, BOOTSTRAP_ROOT, 'recipes');
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
          sourcePath: `${BOOTSTRAP_ROOT.replace(/\\/g, '/')}/recipes/${file}`,
          style: {
            ...style,
            librarySource: 'developer',
            accessTier: 'free',
            registryStatus: 'published',
            contributorName: 'Pyralis Cameron',
          },
        },
      });
    }
  }
  return items;
};

const main = async () => {
  const envFile = await parseEnvFile();
  OWNER_EMAIL = configuredOwnerEmail(
    process.env.CARDFORGE_OWNER_ACCOUNT_EMAILS
      || envFile.CARDFORGE_OWNER_ACCOUNT_EMAILS,
  );
  if (!OWNER_EMAIL) {
    throw new Error('Configure exactly one CARDFORGE_OWNER_ACCOUNT_EMAILS identity for Pipeline publication.');
  }
  const supabaseUrl = process.env.SUPABASE_URL || envFile.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
    || envFile.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || envFile.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  const { data: ownerProfiles, error: ownerError } = await supabase
    .from('cardforge_developer_profiles')
    .select('clerk_user_id,email,first_name,last_name')
    .eq('email', OWNER_EMAIL)
    .eq('status', 'active')
    .limit(2);
  if (ownerError) throw ownerError;

  if (ownerProfiles?.length !== 1) {
    throw new Error('The configured owner identity must match exactly one active Forge Pipeline developer profile.');
  }
  const [ownerProfile] = ownerProfiles;

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
  const canonicalItemByAssetId = new Map(items.map((item) => [item.asset_id, item]));

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
    if (tombstonedAssetIds.has(entry.asset_id)) continue;
    const canonicalItem = canonicalItemByAssetId.get(entry.asset_id);
    const hasLegacyImportedSourcePath = canonicalItem?.metadata?.sourceKind === 'pipeline-owner-import'
      && entry.metadata?.sourceKind === 'pipeline-owner-import'
      && typeof entry.metadata?.sourcePath === 'string'
      && typeof canonicalItem.metadata.sourcePath === 'string'
      && entry.metadata.sourcePath !== canonicalItem.metadata.sourcePath
      && repositoryOwnedSourcePaths(canonicalItem.metadata).has(entry.metadata.sourcePath);
    const hasRepositoryAssetUrl = containsRepositoryAssetUrl(entry.metadata);
    if (!hasRepositoryAssetUrl && !hasLegacyImportedSourcePath) continue;
    const metadata = {
      ...rewritePipelineAssetUrls(entry.metadata, staticCatalog.publicUrlByLocalPath),
      ...(hasLegacyImportedSourcePath
        ? { sourcePath: canonicalItem.metadata.sourcePath }
        : {}),
    };
    if (containsRepositoryAssetUrl(metadata)) {
      throw new Error(`Cannot migrate ${entry.asset_id}: a referenced Studio asset is missing or permanently deleted.`);
    }
    const { error } = await supabase.rpc('cardforge_migrate_pipeline_registry_metadata_urls', {
      p_asset_id: entry.asset_id,
      p_metadata: metadata,
    });
    if (error) throw error;
    console.log(`Normalized Pipeline metadata ownership: ${entry.asset_id}`);
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