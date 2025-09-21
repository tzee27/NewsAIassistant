import { v4 as uuidv4 } from "uuid";
import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { DetectDominantLanguageCommand } from "@aws-sdk/client-comprehend";
import { InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { ddb, comprehend, bedrock, TABLE, MODEL_ID } from "../lib/aws-clients.mjs";
import { json, fetchText, extractItems, pickTopMatches } from "../lib/util.mjs";
import { TRUSTED_SOURCES } from "../lib/sources.mjs";
import { getOpenSearchClient } from "../lib/opensearch-client.mjs";

async function classifyWithBedrock(claim, evidence) {
  const system = "You are a finance fact-checking assistant. Decide if the claim is Supported, Refuted, or Unclear using reliable sources.";
  const user   = `Claim:\n${claim}\n\nCandidate sources:\n${evidence.map((e,i)=>`${i+1}. ${e.title} — ${e.url}`).join("\n")}\n\nReturn JSON: { "verdict": "...", "confidence": 0-1, "explanation": "..." }`;

  const body = {
    input: [
      { role: "system", content: [{ type: "text", text: system }] },
      { role: "user",   content: [{ type: "text", text: user   }] },
    ],
    max_output_tokens: 500, temperature: 0.2, top_p: 0.9
  };

  const r    = await bedrock.send(new InvokeModelCommand({ modelId: MODEL_ID, accept: "application/json", contentType: "application/json", body: JSON.stringify(body) }));
  const resp = JSON.parse(new TextDecoder().decode(r.body));
  let verdict="Unclear", confidence=0.5, explanation="";
  try {
    const j = JSON.parse(resp.output_text || "{}");
    verdict     = j.verdict || verdict;
    confidence  = typeof j.confidence==="number" ? j.confidence : confidence;
    explanation = j.explanation || "";
  } catch {}
  verdict = /support/i.test(verdict) ? "Supported" : /refut/i.test(verdict) ? "Refuted" : "Unclear";
  return { verdict, confidence, explanation };
}

export async function handleSearchVerify(event) {
  const body  = JSON.parse(event.body || "{}");
  const text  = (body.text || "").trim();
  const url   = (body.url  || "").trim();
  if (!text && !url) return json(400, { error: "Provide text or url" });

  const claim = text || `Content from: ${url}`;
  let lang="en";
  try {
    const d = await comprehend.send(new DetectDominantLanguageCommand({ Text: claim }));
    lang = d?.Languages?.[0]?.LanguageCode || "en";
  } catch {}

  // gather top matches from trusted sources
  let candidates = [];
  for (const s of TRUSTED_SOURCES) {
    try {
      const bodyText = await fetchText(s);
      const items = extractItems(s, bodyText);
      candidates.push(...pickTopMatches(items, claim, 2));
    } catch {}
  }
  candidates = candidates.slice(0,6);

  const { verdict, confidence } = await classifyWithBedrock(claim, candidates);

  const id = uuidv4(); const now = Date.now();
  await ddb.send(new PutItemCommand({
    TableName: TABLE,
    Item: {
      id:        { S: id },
      claim:     { S: claim },
      verdict:   { S: verdict },
      confidence:{ N: confidence.toFixed(3) },
      evidence:  { S: JSON.stringify(candidates) },
      url:       { S: url || "" },
      lang:      { S: lang },
      ts:        { N: String(now) },
      recent_pk: { S: "RECENT" }
    }
  }));

  // optional: index to OpenSearch
  const osc = getOpenSearchClient();
  if (osc) {
    try {
      await osc.index({ index: "news-index", id, body: { id, claim, verdict, confidence, evidence: candidates, url, lang, timestamp: now } });
    } catch {}
  }

  return json(200, { id, claim, verdict, confidence, evidence: candidates, source: "Verified by Bedrock", url });
}