import { buildApiUrl } from "./api.js";
import { getIdToken } from "./auth.js";

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Map request failed (${response.status}).`);
  return payload;
}

export async function fetchSharedMaps() {
  const response = await fetch(buildApiUrl("/api/maps"));
  const payload = await readResponse(response);
  return payload.maps || [];
}

export async function fetchSharedMap(mapId) {
  const response = await fetch(buildApiUrl(`/api/maps/${encodeURIComponent(mapId)}`));
  const payload = await readResponse(response);
  return payload.map;
}

export async function publishSharedMap(sourceId, map) {
  const idToken = getIdToken();
  if (!idToken) throw new Error("Sign in before sharing a map.");
  const response = await fetch(buildApiUrl("/api/maps"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ sourceId, map }),
  });
  return readResponse(response);
}
