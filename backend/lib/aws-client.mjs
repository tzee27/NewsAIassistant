import { DynamoDBClient }        from "@aws-sdk/client-dynamodb";
import { ComprehendClient }      from "@aws-sdk/client-comprehend";
import { BedrockRuntimeClient }  from "@aws-sdk/client-bedrock-runtime";

export const REGION   = process.env.AWS_REGION || "us-east-1";
export const TABLE    = process.env.TABLE_NAME || "news_items";
export const MODEL_ID = process.env.MODEL_ID   || "mistral.mistral-large-2402-v1:0";

export const ddb        = new DynamoDBClient({ region: REGION });
export const comprehend = new ComprehendClient({ region: REGION });
export const bedrock    = new BedrockRuntimeClient({ region: REGION });