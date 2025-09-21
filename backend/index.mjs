import { json } from "./lib/util.mjs";
import { handleSearchVerify } from "./routes/searchVerify.mjs";
import { handleRecent }       from "./routes/recent.mjs";
import { handleSearch }       from "./routes/search.mjs";

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || "GET";
  const path   = event.resource || event.rawPath || "/";

  if (method === "OPTIONS") return json(200, { ok: true }); // CORS preflight

  if (path.endsWith("/search_verify") && method === "POST") return handleSearchVerify(event);
  if (path.endsWith("/recent")        && method === "GET")  return handleRecent(event);
  if (path.endsWith("/search")        && method === "GET")  return handleSearch(event);

  return json(404, { error: "Not found" });
};