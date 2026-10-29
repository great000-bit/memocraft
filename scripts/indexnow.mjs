// Tells Bing (and the other IndexNow engines: Yandex, Seznam, Naver) that the public pages changed, so they re-crawl in
// hours instead of weeks. Bing's index also feeds Copilot and ChatGPT search. Run after a deploy that changes public
// pages: `node scripts/indexnow.mjs`. The key is public by design; the file at /<key>.txt proves we own the site.
const SITE = "https://www.memocraft.space";
const KEY = "c91ee79cc48b448347fc8afac13d28eb";

const sitemap = await (await fetch(`${SITE}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`);
