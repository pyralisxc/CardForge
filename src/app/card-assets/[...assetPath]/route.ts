const LEGACY_PIPELINE_TEXTURE = /^textures\/arcane-forge\/[a-z0-9-]+\.webp$/iu;
const LEGACY_PIPELINE_STORAGE_PREFIX = '/storage/v1/object/public/cardforge-contributor-assets/owner-defaults/';

/**
 * Older installed Sets retain CardForge-local texture references. The asset
 * registry now owns those immutable WebP files in Supabase storage, so keep
 * old authored documents renderable without rewriting them on open.
 */
export async function GET(
  _request: Request,
  context: RouteContext<'/card-assets/[...assetPath]'>,
) {
  const { assetPath } = await context.params;
  const path = assetPath.join('/');
  const storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;

  if (!LEGACY_PIPELINE_TEXTURE.test(path) || !storageOrigin) {
    return new Response(null, { status: 404 });
  }

  return Response.redirect(
    new URL(`${LEGACY_PIPELINE_STORAGE_PREFIX}${path}`, storageOrigin),
    307,
  );
}
