# NewsAI — AI-assisted Claim Verification (Web)

Verify posts, links, images, and videos as **Real**, **Fake**, or **Unverified** with transparent evidence and a confidence score.

![Architecture](<img width="723" height="401" alt="Screenshot 2025-09-21 194507" src="https://github.com/user-attachments/assets/af61144d-4f60-47ea-be60-4d0187563032" />)
) <!-- upload your diagram to docs/architecture.png -->

## ✨ Features
- Submit **URL / text / image / video** for verification
- Verdict: **Real / Fake / Unverified** + **confidence score (0–1)**
- **Evidence list** with source names, snippets, and links
- **Dashboard** with counts & filters; collective record of all verifications
- Multilingual input (optional: Comprehend + Translate)
- Built on **AWS** for scale and auditability

## 🧠 How it works (High level)
1. **Normalize input**  
   - URL → fetch page → extract text  
   - Text → use as-is  
   - Image/Video → (optional V1) OCR/extract text → use same path
2. **Plan & retrieve** (Lambda)  
   - Bedrock (Llama 3.1 70B or Mistral Large) extracts the claim and generates queries.  
   - OpenSearch runs those queries against a **trusted sources** index and returns top evidence.
3. **Judge**  
   - Bedrock receives the claim + 5 snippets/links and returns `supported | refuted | unverified` + `confidence`.
4. **Persist & respond**  
   - Save to DynamoDB (`news_items`) and return a JSON result to the UI.

## 🧰 AWS Services Used
- **Amplify Hosting** — deploys the React frontend.
- **API Gateway** — HTTPS endpoints (`/search_verify`).
- **Lambda (Node.js)** — orchestrates retrieval + LLM judging; writes to DynamoDB.
- **Amazon Bedrock** — LLM (Meta Llama 3.1-70B Instruct or Mistral Large 24.02) for planning/judgment.
- **Amazon OpenSearch Service** — index of trusted sources; returns top evidence/snippets.
- **Amazon DynamoDB** — stores verification history for the dashboard.
- **Amazon S3** — optional storage for uploaded images/videos.
- **Amazon CloudWatch** — logs & alarms.

> Region: **us-east-1** (all resources aligned).  
> Current model access: **meta.llama3-1-70b-instruct-v1:0** or **mistral.mistral-large-2402-v1:0**.
