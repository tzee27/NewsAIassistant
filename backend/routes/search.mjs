import { json } from "../lib/util.mjs";
import { getOpenSearchClient } from "../lib/opensearch-client.mjs";

export async function handleSearch(event) {
  const q = (event.queryStringParameters?.q || "").trim();
  const osc = getOpenSearchClient();
  if (!osc || !q) return json(200, []);
  const r = await osc.search({
    index: "news-index",
    body: { query: { multi_match: { query: q, fields: ["claim^2","evidence.title","evidence.snippet"] } } }
  });
  const hits = (r.hits?.hits || []).map(h => h._source);
  return json(200, hits);
}