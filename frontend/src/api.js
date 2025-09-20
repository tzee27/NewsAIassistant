// src/api.js
const API_BASE = process.env.REACT_APP_API_BASE; // set in Amplify or in .env for local

export async function verifyContent(payload) {
  // payload is { url } or { text }
  const res = await fetch(`${API_BASE}/search_verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// Optional endpoints if/when you add them in API Gateway
export async function listRecent(limit = 20) {
  const res = await fetch(`${API_BASE}/recent?limit=${limit}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function searchOpenSearch(q) {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}