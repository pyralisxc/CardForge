import { NextResponse } from 'next/server';
import { getCurrentOwnerAccess, recordOwnerActivity } from '@/features/owner/server';
import { completePendingMetaPageSelection } from '@/features/marketing-distribution/server';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

export async function POST(request: Request) {
  const owner = await getCurrentOwnerAccess();
  if (!owner.isOwner || !owner.userId) return new Response('Owner required', {status:403});
  const form = await request.formData();
  const selection = String(form.get('selection') ?? '');
  const cancel = form.get('cancel') === 'true';
  const page = cancel ? null : String(form.get('page') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(selection) || (!cancel && !page))
    return new Response('Invalid Page selection', {status:400});
  try {
    const result = await completePendingMetaPageSelection(selection,owner.userId,page);
    if (!result.cancelled) await recordOwnerActivity({
      actorUserId:owner.userId,actorEmail:owner.email,action:'marketing.meta.connect',
      targetType:'marketing_provider',targetId:'meta',
      summary:`Connected ${result.connectionCount} Meta destinations.`,metadata:result,
    });
    return NextResponse.redirect(new URL(
      result.cancelled ? '/account?section=library&scope=campaigns&meta=cancelled'
        : '/account?section=library&scope=campaigns&meta=connected',getPublicAppUrl()),303);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Page selection failed', {status:409});
  }
}
