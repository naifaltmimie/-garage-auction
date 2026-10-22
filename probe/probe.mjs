// Which Saudi car-ad sources can a build reach, and what do their pages look like?
import fs from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const out = [];
const log = (s) => { out.push(s); console.log(s.slice(0, 400)); };
async function probe(label, url, init = {}) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { redirect: 'follow', ...init, headers: { 'User-Agent': UA, 'Accept-Language': 'ar,en;q=0.8', Accept: 'text/html,application/json,*/*', ...(init.headers || {}) } });
    const text = await r.text();
    log(`\n### ${label}\nURL ${url}\nSTATUS ${r.status} ${r.headers.get('content-type')} len=${text.length} ms=${Date.now() - t0} final=${r.url}`);
    const posts = [...new Set([...text.matchAll(/\/(11\d{8,10})\//g)].map((m) => m[1]))];
    log(`post-ids(${posts.length}): ${posts.slice(0, 12).join(' ')}`);
    log(`next_data: ${/__NEXT_DATA__/.test(text)} graphql: ${/graphql/.test(text)} imgs: ${(text.match(/postcdn\.haraj\.com\.sa\/[^"' )]+/g) || []).length}`);
    log('HEAD>>> ' + text.slice(0, 1500).replace(/\s+/g, ' '));
    const i = text.indexOf('__NEXT_DATA__');
    if (i > 0) log('NEXT>>> ' + text.slice(i, i + 3000).replace(/\s+/g, ' '));
    const j = text.search(/graphql\.haraj/);
    if (j > 0) log('GQL>>> ' + text.slice(Math.max(0, j - 600), j + 900).replace(/\s+/g, ' '));
    return text;
  } catch (e) {
    log(`\n### ${label}\nURL ${url}\nERROR ${e}`);
    return '';
  }
}
const q = encodeURIComponent('لاندكروزر 2015');
await probe('haraj search', `https://haraj.com.sa/search/${q}`);
await probe('haraj tag', `https://haraj.com.sa/tags/${encodeURIComponent('تويوتا لاندكروزر')}`);
await probe('haraj post', 'https://haraj.com.sa/11191108433');
await probe('haraj home', 'https://haraj.com.sa/');
// GraphQL guesses (the web app's API)
const gql = (name, query, variables) => probe(`haraj graphql ${name}`, `https://graphql.haraj.com.sa/?queryName=${name}&token=&clientid=&version=9.0.0`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://haraj.com.sa', Referer: 'https://haraj.com.sa/' },
  body: JSON.stringify({ query, variables }),
});
await gql('detailsPosts_singlePost', 'query($ids:[Int]) { posts(id:$ids) { items { id title city postDate bodyTEXT imagesList tags price { formattedPrice } } } }', { ids: [11191108433] });
await gql('posts_tag', 'query($tag:String,$page:Int) { posts(tag:$tag, page:$page) { items { id title city postDate imagesList tags } pageInfo { hasNextPage } } }', { tag: 'تويوتا لاندكروزر', page: 1 });
await gql('search', 'query($search:String,$page:Int) { search(search:$search, page:$page) { items { id title city imagesList } pageInfo { hasNextPage } } }', { search: 'لاندكروزر 2015', page: 1 });
// other Saudi sources
await probe('syarah', 'https://syarah.com/');
await probe('syarah used', 'https://syarah.com/filters?is_new=0');
await probe('motory', 'https://www.motory.com/ar/');
await probe('yallamotor', 'https://ksa.yallamotor.com/ar/used-cars');
await probe('opensooq', 'https://sa.opensooq.com/ar/%D8%B3%D9%8A%D8%A7%D8%B1%D8%A7%D8%AA-%D9%88%D9%85%D8%B1%D9%83%D8%A8%D8%A7%D8%AA/%D8%B3%D9%8A%D8%A7%D8%B1%D8%A7%D8%AA-%D9%84%D9%84%D8%A8%D9%8A%D8%B9');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/probe.txt', out.join('\n'));
