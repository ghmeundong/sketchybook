import { buildApiUrl } from "./api.js";
import { getIdToken } from "./auth.js";

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Map request failed (${response.status}).`);
  return payload;
}

function authHeaders() {
  const idToken = getIdToken();
  if (!idToken) throw new Error("Sign in to save maps to your account.");
  return { Authorization: `Bearer ${idToken}` };
}

export async function fetchAccountMaps() {
  const response = await fetch(buildApiUrl("/api/user/maps"), {
    headers: authHeaders(),
  });
  const payload = await readResponse(response);
  return payload.maps || [];
}

export async function saveAccountMap(sourceId, map) {
  const response = await fetch(buildApiUrl("/api/user/maps"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ sourceId, map }),
  });
  return readResponse(response);
}
