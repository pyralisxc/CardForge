export const dynamic = 'force-dynamic';

export async function GET() {
  const token = process.env.OPENAI_APPS_CHALLENGE_TOKEN?.trim();
  if (!token || token.length > 2_048 || /[\r\n]/u.test(token)) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return new Response(token, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
