import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

const OWNER_EMAIL = process.env.CARDFORGE_PIPELINE_OWNER_EMAIL || 'cameron.r.locke96@gmail.com';
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

const upsertSubmissionForRegistryAsset = async (supabase, item, ownerProfile) => {
  const { data: existingRows, error: loadError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .select('id')
    .eq('registry_asset_id', item.asset_id)
    .limit(1);

  if (loadError) throw loadError;

  const patch = {
    developer_id: ownerProfile.clerk_user_id,
    developer_email: ownerProfile.email,
    asset_type: item.developer_asset_type,
    name: item.name,
    description: item.description,
    preview_url: item.preview_url,
    source_url: item.url,
    source_file_size_bytes: item.file_size_bytes,
    source_mime_type: item.source_mime_type,
    source_storage_bucket: item.storage_bucket,
    source_storage_path: item.storage_path,
    registry_asset_id: item.asset_id,
    status: 'published',
    calculated_access_tier: 'free',
    owner_access_tier_override: null,
    quality_score: 0,
    tier_decision_reason: 'free_candidate',
    decision_reason: 'pipeline_owner_import',
  };

  const existing = existingRows?.[0];
  if (existing) {
    const { error } = await supabase
      .from('cardforge_developer_asset_submissions')
      .update(patch)
      .eq('id', existing.id);
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from('cardforge_developer_asset_submissions')
    .insert(patch)
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
};

const upsertRegistryItem = async (supabase, item, ownerProfile) => {
  const baseRegistryRow = {
    asset_id: item.asset_id,
    name: item.name,
    asset_type: item.registry_asset_type,
    url: item.url,
    preview_url: item.preview_url,
    status: 'published',
    access_tier: 'free',
    library_source: 'developer',
    storage_bucket: item.storage_bucket,
    storage_path: item.storage_path,
    file_size_bytes: item.file_size_bytes,
    metadata: item.metadata,
  };

  const { error: registrySeedError } = await supabase
    .from('cardforge_asset_registry')
    .upsert(baseRegistryRow, { onConflict: 'asset_id' });
  if (registrySeedError) throw registrySeedError;

  const submissionId = await upsertSubmissionForRegistryAsset(supabase, item, ownerProfile);
  const { error } = await supabase
    .from('cardforge_asset_registry')
    .upsert({
      ...baseRegistryRow,
      developer_submission_id: submissionId,
    }, { onConflict: 'asset_id' });
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
    const style = await readJson(path.join(directory, file));
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
  return items;
};

const borderAppearance = (background, border, backgroundImage) => ({
  material: { baseColor: background },
  border,
  ...(backgroundImage ? { rawCss: { backgroundImage } } : {}),
});

const styleItem = (style, sourcePath = 'scripts/sync-pipeline-defaults.mjs#seeded-recipes') => ({
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
  description: `${style.name} starter recipe imported into the Forge Pipeline.`,
  metadata: {
    sourceKind: 'pipeline-owner-import',
    sourcePath,
    style: {
      ...style,
      librarySource: 'developer',
      accessTier: 'free',
      registryStatus: 'published',
      contributorName: OWNER_EMAIL,
    },
  },
});

const collectSeededRecipeItems = async () => {
  const shapeRoles = [
    {
      id: 'shape-role-panel',
      name: 'Panel',
      kind: 'shapeRole',
      targets: ['shape'],
      appearance: {
        shapeRole: 'panel',
        material: { baseColor: 'rgba(18,15,11,0.72)', texture: { kind: 'uploaded', assetSource: '/card-assets/textures/dark-leather.svg', assetKind: 'texture', textureOpacity: 42, textureScale: 180, blendMode: 'overlay' } },
        border: { kind: 'relic', color: '#d5ad54', width: 2, radius: 8 },
        effects: { innerHighlight: 18, bevel: 20 },
      },
      updates: { shapeRole: 'panel', shapeKind: 'rectangle', width: 360, height: 140, borderRadius: 'rounded-md' },
    },
    {
      id: 'shape-role-art-frame',
      name: 'Art Frame',
      kind: 'shapeRole',
      targets: ['shape'],
      appearance: { shapeRole: 'artFrame', material: { baseColor: 'rgba(0,0,0,0.04)', texture: { kind: 'none' } }, border: { kind: 'relic', color: '#d5ad54', secondaryColor: '#7a52cc', width: 4, radius: 10 }, effects: { glow: 10, innerHighlight: 16 } },
      updates: { shapeRole: 'artFrame', shapeKind: 'corner-frame', width: 500, height: 330, fillColor: 'transparent', backgroundColor: 'transparent' },
    },
    {
      id: 'shape-role-rules-box',
      name: 'Rules Box',
      kind: 'shapeRole',
      targets: ['shape'],
      appearance: {
        shapeRole: 'rulesBox',
        material: { baseColor: 'rgba(244,226,186,0.94)', textColor: '#20140a', texture: { kind: 'uploaded', assetSource: '/card-assets/textures/parchment-grain.svg', assetKind: 'texture', textureOpacity: 46, textureScale: 160, blendMode: 'multiply' } },
        border: { kind: 'relic', color: '#4a2f12', secondaryColor: '#d5ad54', width: 4, radius: 8 },
        effects: { innerHighlight: 28, bevel: 22 },
      },
      updates: { shapeRole: 'rulesBox', shapeKind: 'notch-panel', width: 500, height: 180 },
    },
    {
      id: 'shape-role-title-plate',
      name: 'Title Plate',
      kind: 'shapeRole',
      targets: ['shape'],
      appearance: {
        shapeRole: 'titlePlate',
        material: { baseColor: '#17100b', textColor: '#f7df9d', texture: { kind: 'uploaded', assetSource: '/card-assets/textures/hammered-metal.svg', assetKind: 'texture', textureOpacity: 28, textureScale: 150, blendMode: 'overlay' } },
        border: { kind: 'double', color: '#d5ad54', width: 2, radius: 6 },
        effects: { glow: 8, bevel: 18 },
      },
      updates: { shapeRole: 'titlePlate', shapeKind: 'banner', width: 430, height: 48 },
    },
    {
      id: 'shape-role-stat-gem',
      name: 'Stat Gem',
      kind: 'shapeRole',
      targets: ['shape'],
      appearance: { shapeRole: 'statGem', material: { baseColor: '#0b0f15', texture: { kind: 'uploaded', assetSource: '/card-assets/textures/purple-foil.svg', assetKind: 'texture', textureOpacity: 36, textureScale: 190, blendMode: 'screen' } }, border: { kind: 'foil', color: '#d5ad54', secondaryColor: '#7a52cc', width: 3, radius: 8 }, effects: { glow: 16 } },
      updates: { shapeRole: 'statGem', shapeKind: 'diamond', width: 64, height: 64 },
    },
    {
      id: 'shape-role-cost-orb',
      name: 'Cost Orb',
      kind: 'shapeRole',
      targets: ['shape'],
      appearance: { shapeRole: 'costOrb', material: { baseColor: '#0b0f15', texture: { kind: 'uploaded', assetSource: '/card-assets/textures/hammered-metal.svg', assetKind: 'texture', textureOpacity: 34, textureScale: 150, blendMode: 'overlay' } }, border: { kind: 'foil', color: '#d5ad54', secondaryColor: '#f5d27b', width: 3, radius: 999 }, effects: { glow: 14, innerHighlight: 20 } },
      updates: { shapeRole: 'costOrb', shapeKind: 'ellipse', width: 64, height: 64, borderRadius: 'rounded-full' },
    },
  ];

  const borders = [
    ['border-none', 'None', '#111720', { kind: 'none', width: 0, radius: 0 }],
    ['border-gold-hairline', 'Gold Hairline', '#111720', { kind: 'solid', color: '#d5ad54', width: 1, radius: 6 }],
    ['border-heavy-relic', 'Heavy Relic', '#17100b', { kind: 'relic', color: '#9f742a', secondaryColor: '#d5ad54', width: 4, radius: 8, innerWidth: 1 }],
    ['border-arcane-edge', 'Arcane Edge', '#160d25', { kind: 'foil', color: '#7a52cc', secondaryColor: '#bda2ff', width: 2, radius: 12 }],
    ['border-circle-seal', 'Circle Seal', '#151008', { kind: 'double', color: '#d5ad54', width: 2, radius: 999 }],
    ['border-etched-frame', 'Etched Frame', '#140f09', { kind: 'etched', color: '#d5ad54', secondaryColor: '#5f4216', width: 4, radius: 6, innerWidth: 1 }],
    ['border-violet-relic', 'Violet Relic', '#160d25', { kind: 'relic', color: '#7a52cc', secondaryColor: '#d8c4ff', width: 4, radius: 12, innerWidth: 1 }],
  ].map(([id, name, background, border]) => ({
    id,
    name,
    kind: 'border',
    targets: ['text', 'image', 'icon', 'shape'],
    appearance: borderAppearance(background, border),
  }));

  const dividers = [
    ['divider-gilded-filigree-seed', 'Gilded Filigree', '#d5ad54', 'linear-gradient(90deg, transparent 0%, #7f5d1f 8%, #f5d27b 18%, #7f5d1f 28%, transparent 36%, #d5ad54 50%, transparent 64%, #7f5d1f 72%, #f5d27b 82%, #7f5d1f 92%, transparent 100%)', 14],
    ['divider-mana-thread-seed', 'Mana Thread', '#7a52cc', 'linear-gradient(90deg, transparent, #7a52cc 16%, #d5ad54 50%, #7a52cc 84%, transparent)', 10],
    ['divider-double-gold-seed', 'Double Gold', '#d5ad54', 'linear-gradient(180deg, transparent 0 25%, #d5ad54 25% 38%, transparent 38% 62%, #d5ad54 62% 75%, transparent 75%)', 12],
    ['divider-bloodline-seed', 'Bloodline', '#8c2718', 'linear-gradient(90deg, transparent, #8c2718 18%, #f0b15a 50%, #8c2718 82%, transparent)', 10],
    ['divider-chevron-relic-seed', 'Chevron Relic', '#7a52cc', 'repeating-linear-gradient(120deg, transparent 0 10px, rgba(255,255,255,0.16) 10px 15px), linear-gradient(90deg, transparent, #4d2096 14%, #d5ad54 50%, #4d2096 86%, transparent)', 18],
    ['divider-gem-center-seed', 'Gem Center', '#d5ad54', 'linear-gradient(90deg, transparent, #7f5d1f 20%, transparent 42%, #f5d27b 47%, #7a52cc 50%, #f5d27b 53%, transparent 58%, #7f5d1f 80%, transparent)', 20],
  ].map(([id, name, color, backgroundImage, height]) => ({
    id,
    name,
    kind: 'divider',
    targets: ['divider', 'shape'],
    appearance: { shapeRole: 'divider', material: { baseColor: color, texture: { kind: 'none' } }, border: { kind: 'none', width: 0, radius: 999 }, rawCss: { backgroundImage } },
    updates: { shapeKind: 'rectangle', shapeRole: 'divider', width: 470, height, strokeWidth: 0, fillColor: color, backgroundImageUrl: backgroundImage, borderWidth: '_none_', borderRadius: 'rounded-full', appearance: { shapeRole: 'divider' } },
  }));

  const icons = [
    ['icon-style-fire', 'Fire', 'Flame', '#210b06', '#ffb35f', '#d67425', 'rgba(132,37,15,0.72)'],
    ['icon-style-water', 'Water', 'Droplets', '#071521', '#9ddcff', '#49a7df', 'rgba(47,125,185,0.45)'],
    ['icon-style-arcane', 'Arcane', 'WandSparkles', '#190f2c', '#d8c4ff', '#7a52cc', 'rgba(122,82,204,0.42)'],
    ['icon-style-nature', 'Nature', 'Leaf', '#0b1a0f', '#b9f2a1', '#6fb06a', 'rgba(62,137,78,0.48)'],
    ['icon-style-shadow', 'Shadow', 'Skull', '#08070a', '#e6d8ff', '#8066a8', 'rgba(36,28,46,0.82)'],
    ['icon-style-relic', 'Relic', 'Gem', '#151008', '#ffe09b', '#d5ad54', 'rgba(213,173,84,0.34)'],
  ].map(([id, name, iconName, baseColor, strokeColor, borderColor, fillColor]) => ({
    id,
    name,
    kind: 'icon',
    targets: ['icon'],
    appearance: { material: { baseColor, textColor: strokeColor, fillColor, strokeColor }, border: { kind: 'solid', color: borderColor, width: 1, radius: 999 }, effects: { glow: 14 } },
    updates: { iconName, strokeColor, fillColor, backgroundColor: baseColor, borderColor, borderWidth: name === 'Arcane' || name === 'Relic' ? 'border-2' : 'border', borderRadius: 'rounded-full' },
  }));

  return [
    ...shapeRoles,
    ...borders,
    ...dividers,
    ...icons,
  ].map((style) => styleItem(style));
};

const main = async () => {
  const envFile = await parseEnvFile();
  const supabaseUrl = process.env.SUPABASE_URL || envFile.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envFile.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: ownerProfiles, error: ownerError } = await supabase
    .from('cardforge_developer_profiles')
    .select('clerk_user_id,email,first_name,last_name')
    .eq('email', OWNER_EMAIL)
    .limit(1);
  if (ownerError) throw ownerError;

  const ownerProfile = ownerProfiles?.[0] || { clerk_user_id: OWNER_EMAIL, email: OWNER_EMAIL };
  await supabase
    .from('cardforge_developer_profiles')
    .upsert({
      clerk_user_id: ownerProfile.clerk_user_id,
      email: OWNER_EMAIL,
      status: 'active',
      eligible_for_profit_share: true,
    }, { onConflict: 'clerk_user_id' });

  const items = [
    ...await collectStaticAssetItems(supabase),
    ...await collectTemplateItems(),
    ...await collectStyleItems(),
    ...await collectSeededRecipeItems(),
  ];

  for (const item of items) {
    await upsertRegistryItem(supabase, item, { ...ownerProfile, email: OWNER_EMAIL });
    console.log(`Synced ${item.registry_asset_type}: ${item.name}`);
  }

  const { error: legacySubmissionError } = await supabase
    .from('cardforge_developer_asset_submissions')
    .update({
      developer_id: ownerProfile.clerk_user_id,
      developer_email: OWNER_EMAIL,
      calculated_access_tier: 'free',
      owner_access_tier_override: null,
      status: 'published',
    })
    .eq('developer_id', 'cardforge-official');
  if (legacySubmissionError) throw legacySubmissionError;

  console.log(`Synced ${items.length} starter entries into the Forge Pipeline as ${OWNER_EMAIL}.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
