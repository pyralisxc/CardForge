import { createClient } from '@supabase/supabase-js';

const sourceBucket = 'cardforge-developer-assets';
const destinationBucket = 'cardforge-contributor-assets';
const cleanupSource = process.argv.includes('--cleanup-source');
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and a Supabase server secret are required.');
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const listObjects = async (bucket, prefix = '') => {
  const result = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data?.length) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) result.push({ path, size: Number(item.metadata?.size ?? 0) });
      else result.push(...await listObjects(bucket, path));
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return result;
};

const { data: buckets, error: bucketsError } = await client.storage.listBuckets();
if (bucketsError) throw bucketsError;
const source = buckets.find((bucket) => bucket.id === sourceBucket);
if (!source) throw new Error(`Source bucket ${sourceBucket} was not found.`);
if (!buckets.some((bucket) => bucket.id === destinationBucket)) {
  const { error } = await client.storage.createBucket(destinationBucket, {
    public: source.public,
    fileSizeLimit: source.file_size_limit ?? undefined,
    allowedMimeTypes: source.allowed_mime_types ?? undefined,
  });
  if (error) throw error;
}

const sourceObjects = await listObjects(sourceBucket);
let destinationObjects = await listObjects(destinationBucket);
const destinationByPath = new Map(destinationObjects.map((item) => [item.path, item]));

for (const item of sourceObjects) {
  if (destinationByPath.has(item.path)) continue;
  const { error } = await client.storage.from(sourceBucket).copy(
    item.path,
    item.path,
    { destinationBucket },
  );
  if (error) throw new Error(`Unable to copy ${item.path}: ${error.message}`);
}

destinationObjects = await listObjects(destinationBucket);
const verifiedDestination = new Map(destinationObjects.map((item) => [item.path, item]));
for (const item of sourceObjects) {
  const copied = verifiedDestination.get(item.path);
  if (!copied || copied.size !== item.size) {
    throw new Error(`Storage parity failed for ${item.path}.`);
  }
}

if (cleanupSource) {
  for (let index = 0; index < sourceObjects.length; index += 100) {
    const { error } = await client.storage.from(sourceBucket).remove(
      sourceObjects.slice(index, index + 100).map((item) => item.path),
    );
    if (error) throw error;
  }
  const remaining = await listObjects(sourceBucket);
  if (remaining.length) throw new Error('Source bucket still contains objects after cleanup.');
  const { error } = await client.storage.deleteBucket(sourceBucket);
  if (error) throw error;
}

console.log(JSON.stringify({
  sourceObjects: sourceObjects.length,
  destinationObjects: destinationObjects.length,
  sourceRemoved: cleanupSource,
}));
