export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams(searchParams);
  if (!qs.has('bulk')) qs.set('bulk', 'true');

  const backendUrl = `${process.env.BACKEND_URL}/api/addresses/addresses/?${qs.toString()}`;
  const headers = new Headers();
  const auth = req.headers.get('authorization') || '';
  const campaignId = req.headers.get('x-campaign-id') || searchParams.get('campaign') || '';
  if (auth) headers.set('authorization', auth);
  if (campaignId) headers.set('x-campaign-id', campaignId);

  const accept = req.headers.get('accept') || '';
  if (accept) headers.set('accept', accept);

  const upstream = await fetch(backendUrl, { headers, cache: 'no-store' });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      'x-bulk-items': upstream.headers.get('x-bulk-items') || '',
    },
  });
}


