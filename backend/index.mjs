// Lambda runtime: Node.js 22.x (ESM)
import { ComprehendClient, DetectDominantLanguageCommand, DetectKeyPhrasesCommand } from "@aws-sdk/client-comprehend";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

// ---- AWS clients ----
const region = process.env.AWS_REGION || "us-east-1";
const comprehend = new ComprehendClient({ region });
const bedrock = new BedrockRuntimeClient({ region });
const ddb = new DynamoDBClient({ region });

// ---- envs ----
const TABLE = process.env.TABLE_NAME || "items";
// e.g. "mistral.mistral-large-2402-v1:0" OR "meta.llama3-1-70b-instruct-v1:0"
const MODEL_ID = process.env.MODEL_ID || "mistral.mistral-large-2402-v1:0";

// ---- trusted finance sources (extend any time) ----
const SOURCES = [
  "https://www.bnm.gov.my/rss",
  "https://www.sc.com.my/resources/media-releases",
  "https://www.bursamalaysia.com/market_information/announcements/company_announcement",
  "https://www.imf.org/en/News",
  "https://www.worldbank.org/en/news",
  "https://www.reuters.com/world/asia-pacific/",
  "https://www.reuters.com/fact-check/"
];

// ---- helpers ----
const stripHtml = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const topK = (arr, k, scoreFn) =>
  arr
    .map((x) => [x, scoreFn(x)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([x]) => x);

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Fetch ${url} ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  const body = await res.text();
  if (ct.includes("xml") || body.startsWith("<?xml")) return body; // RSS XML
  return stripHtml(body); // HTML
}

// Very light RSS/HTML extractor
function extractItems(url, bodyText) {
  // RSS
  if (bodyText.includes("<item>")) {
    const items = [...bodyText.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/gi)].map(
      (m) => ({
        title: m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim(),
        url: m[2].trim(),
        source: url
      })
    );
    return items.slice(0, 25);
  }
  // HTML anchors as fallback
  const items = [...bodyText.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]{10,120})<\/a>/gi)].map((m) => ({
    url: new URL(m[1], url).href,
    title: m[2].trim(),
    source: url
  }));
  const seen = new Set();
  return items.filter((i) => !seen.has(i.url) && seen.add(i.url)).slice(0, 25);
}

function scoreByKeywords(text, title) {
  const toks = new Set(text.toLowerCase().split(/\W+/).filter((x) => x.length > 3));
  const t2 = title.toLowerCase().split(/\W+/).filter((x) => x.length > 3);
  const hit = t2.filter((w) => toks.has(w)).length;
  return hit + (title.toLowerCase().includes(text.toLowerCase().slice(0, 60)) ? 2 : 0);
}

async function comprehendKeyPhrases(text, langHint) {
  const lang =
    langHint ||
    (await comprehend.send(new DetectDominantLanguageCommand({ Text: text }))).Languages?.[0]?.LanguageCode ||
    "en";
  const kp = await comprehend.send(new DetectKeyPhrasesCommand({ Text: text, LanguageCode: lang }));
  const phrases = (kp.KeyPhrases || []).map((p) => p.Text).slice(0, 8);
  return { lang, phrases };
}

function buildPrompt(claim, evidenceDocs) {
  const context = evidenceDocs
    .map(
      (d, i) => `[Doc ${i + 1}] Title: ${d.title}
URL: ${d.url}
Snippet: ${d.snippet}
`
    )
    .join("\n");

  return `You are a finance fact-checker. Decide if the CLAIM is supported by the EVIDENCE docs.

CLAIM:
${claim}

EVIDENCE:
${context}

Output a single JSON object with fields:
{"verdict":"Supported|Refuted|Unclear","confidence":0-100,"used":[doc_numbers],"explanation":"short reason"}

Only output JSON.`;
}

// --- Bedrock reasoning (supports Mistral & Llama 3.1) ---
async function callBedrock(prompt) {
  // TGI-style schema (Mistral & Llama in Bedrock)
  const body =
    MODEL_ID.startsWith("mistral.") // e.g. "mistral.mistral-large-2402-v1:0"
      ? {
          prompt, // Mistral expects "prompt"
          max_tokens: 400,
          temperature: 0.2
        }
      : MODEL_ID.startsWith("meta.llama3-1-70b") // e.g. "meta.llama3-1-70b-instruct-v1:0"
      ? {
          prompt, // Llama also uses "prompt"
          max_gen_len: 400, // Llama’s parameter name
          temperature: 0.2
        }
      : (() => {
          throw new Error("Unsupported MODEL_ID: " + MODEL_ID);
        })();

  const res = await bedrock.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body)
    })
  );

  const raw = new TextDecoder().decode(res.body);

  // Try a few common shapes
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j.outputs) && j.outputs[0]?.text) return j.outputs[0].text; // Mistral
    if (j.generation) return j.generation; // some providers
    if (j.outputText) return j.outputText;
  } catch {
    /* fallthrough */
  }
  return raw;
}

// ---- Lambda handler ----
export const handler = async (event) => {
  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
    let { text, url, id } = body;

    // If URL provided, fetch and extract text
    if (url && !text) {
      const html = await fetchText(url);
      text = stripHtml(html).slice(0, 8000);
    }
    if (!text) throw new Error("Provide 'text' or 'url'");

    // Key phrases → compact claim string
    const { phrases } = await comprehendKeyPhrases(text);
    const claim = phrases.length ? phrases.join(", ") : text.slice(0, 280);

    // Fetch trusted sources concurrently
    const pages = await Promise.allSettled(
      SOURCES.map(async (s) => {
        const t = await fetchText(s);
        return extractItems(s, t);
      })
    );
    const items = pages.flatMap((p) => (p.status === "fulfilled" ? p.value : []));

    // Rank and fetch snippets
    const top = topK(items, 5, (it) => scoreByKeywords(claim, it.title));
    const withSnippets = [];
    for (const it of top) {
      try {
        const txt = await fetchText(it.url);
        withSnippets.push({ ...it, snippet: txt.slice(0, 1200) });
      } catch {
        // ignore
      }
    }

    // ---- Bedrock call via helper ----
    const prompt = buildPrompt(claim, withSnippets);
    const modelText = await callBedrock(prompt);
    const jsonStr = modelText.match(/\{[\s\S]*\}/)?.[0] || "{}";
    const verdictObj = JSON.parse(jsonStr);

    // ---- Cache to DynamoDB ----
    const itemId = id || "q_" + Date.now();
    await ddb.send(
      new PutItemCommand({
        TableName: TABLE,
        Item: {
          id: { S: itemId },
          claim: { S: claim },
          verdict: { S: verdictObj.verdict || "Unclear" },
          confidence: { N: String(verdictObj.confidence || 0) },
          evidence_links: { S: JSON.stringify(withSnippets.map((d) => d.url)) },
          timestamp: { S: new Date().toISOString() }
        }
      })
    );

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({
        id: itemId,
        claim,
        verdict: verdictObj.verdict || "Unclear",
        confidence: verdictObj.confidence || 0,
        used: verdictObj.used || [],
        explanation: verdictObj.explanation || "",
        evidence: withSnippets.map((d) => ({ title: d.title, url: d.url }))
      })
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ error: String(err) })
    };
  }
};