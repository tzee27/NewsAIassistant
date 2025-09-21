export const json = (statusCode, body) => ({
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type,authorization,x-amz-date,x-api-key,x-amz-security-token",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    },
    body: JSON.stringify(body),
  });
  
  export const stripHtml = (html="") =>
    html.replace(/<script[\s\S]*?<\/script>/gi," ")
        .replace(/<style[\s\S]*?<\/style>/gi," ")
        .replace(/<[^>]+>/g," ")
        .replace(/\s+/g," ").trim();
  
  export async function fetchText(url) {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const body = await r.text();
    if (ct.includes("xml") || body.startsWith("<?xml")) return body; // RSS/Atom
    return stripHtml(body);
  }
  
  export function extractItems(baseUrl, body) {
    const out = [];
    const items = [...body.matchAll(/<item[\s\S]*?<\/item>/gi)];
    if (items.length) {
      for (const m of items) {
        const b = m[0];
        const title = (b.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g,"").trim();
        const link  = (b.match(/<link>([\s\S]*?)<\/link>/i)?.[1]  || "").trim();
        const desc  = (b.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g,"").trim();
        if (title && link) out.push({ title, url: link, snippet: stripHtml(desc) });
      }
      return out;
    }
    // very light HTML fallback
    const a = [...body.matchAll(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi)];
    for (const m of a) {
      const url = m[1].startsWith("http") ? m[1] : new URL(m[1], baseUrl).href;
      const text = stripHtml(m[2]);
      if (text.length > 40) out.push({ title: text.slice(0,180), url, snippet: "" });
    }
    return out.slice(0,50);
  }
  
  function score(text, q) {
    const T = s => s.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(Boolean);
    const A = new Set(T(text)); const B = new Set(T(q));
    let hit=0; for (const w of B) if (A.has(w)) hit++;
    return hit / Math.max(1, B.size);
  }
  
  export function pickTopMatches(items, query, k=5, minScore=0.2) {
    return items.map(x => ({...x, _s: Math.max(score(x.title,query), score(x.snippet||"",query))}))
                .filter(x => x._s >= minScore)
                .sort((a,b)=>b._s-a._s)
                .slice(0,k)
                .map(({_s,...rest})=>rest);
  }  