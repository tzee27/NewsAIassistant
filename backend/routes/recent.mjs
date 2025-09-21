import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { ddb, TABLE } from "../lib/aws-clients.mjs";
import { json } from "../lib/util.mjs";

export async function handleRecent(event) {
  const limit = Number(event?.queryStringParameters?.limit || 20);
  const r = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: "gsi_recent",
    KeyConditionExpression: "recent_pk = :rp",
    ExpressionAttributeValues: { ":rp": { S: "RECENT" } },
    ScanIndexForward: false,
    Limit: limit
  }));
  const rows = (r.Items || []).map(it => ({
    id: it.id.S,
    claim: it.claim.S,
    verdict: it.verdict.S,
    confidence: Number(it.confidence.N),
    evidence: JSON.parse(it.evidence.S || "[]"),
    url: it.url?.S || "",
    source: "Verified by Bedrock"
  }));
  return json(200, rows);
}