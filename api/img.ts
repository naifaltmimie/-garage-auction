// Last-resort image relay for players whose network can't reach the listing CDN directly.
// The gallery only asks here after the light and the original photo both failed to load.
export const config = { runtime: 'edge' };

const ALLOW = /^https:\/\/(?:mimg\d*cdn|postcdn)\.haraj\.com\.sa\/userfiles\d*\/[\w\-./]+\.(?:jpe?g|png|webp)(?:-700\.webp)?$/i;
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

export default async function handler(req: Request): Promise<Response> {
  const u = new URL(req.url).searchParams.get('u') ?? '';
  if (!ALLOW.test(u)) return new Response('unsupported image url', { status: 400 });
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' } });
    const type = r.headers.get('content-type') ?? '';
    if (!r.ok || !r.body || !type.startsWith('image/')) return new Response(`upstream ${r.status}`, { status: 502 });
    return new Response(r.body, {
      status: 200,
      headers: {
        'content-type': type,
        'cache-control': 'public, max-age=86400, s-maxage=2592000, immutable',
        'access-control-allow-origin': '*',
      },
    });
  } catch {
    return new Response('upstream unreachable', { status: 504 });
  }
}
