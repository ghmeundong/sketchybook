import {
  getStoredStageProgress,
  getStoredStageScores,
  setStoredStageProgress,
  setStoredStageScores,
} from "./game/ui/stageProgress.js";
import { buildApiUrl } from "./services/api.js";

const AUTH_STORAGE_KEY = "sketchy_user";
const PROGRESS_API_PATH = "/api/progress";
const SYNC_MODES = ["normal", "challenge"];

export function getStoredUser() {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function getIdToken() {
  const user = getStoredUser();
  return user && typeof user.id_token === "string" ? user.id_token : null;
}

export function isUserLoggedIn() {
  return Boolean(getIdToken());
}

function getAuthHeaders() {
  const idToken = getIdToken();
  if (!idToken) return {};
  return {
    Authorization: `Bearer ${idToken}`,
  };
}

function buildProgressUrl(mode) {
  return buildApiUrl(`${PROGRESS_API_PATH}?mode=${encodeURIComponent(mode)}`);
}

export async function fetchServerProgress(mode) {
  const authHeaders = getAuthHeaders();
  if (!authHeaders.Authorization) {
    console.log(`[auth] fetchServerProgress(${mode}) skipped: no auth token`);
    return null;
  }

  try {
    console.log(`[auth] fetching server progress for '${mode}' mode...`);
    const resp = await fetch(buildProgressUrl(mode), {
      method: "GET",
      headers: {
        ...authHeaders,
      },
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.warn(`[auth] server progress fetch failed for '${mode}' mode:`, data);
      return null;
    }
    console.log(`[auth] server progress for '${mode}' mode loaded:`, data);
    return data;
  } catch (error) {
    console.warn(`[auth] fetchServerProgress(${mode}) error:`, error);
    return null;
  }
}

export async function saveProgressToServer(mode) {
  const authHeaders = getAuthHeaders();
  if (!authHeaders.Authorization) {
    console.log(`[auth] saveProgressToServer(${mode}) skipped: no auth token`);
    return false;
  }

  const progress = getStoredStageProgress(mode);
  const scores = getStoredStageScores(mode);

  try {
    console.log(`[auth] saving local progress to server for '${mode}' mode:`, { progress, scores });
    const resp = await fetch(buildProgressUrl(mode), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ progress, scores }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.warn(`[auth] saveProgressToServer(${mode}) failed:`, data);
      return false;
    }
    console.log(`[auth] saved progress to server for '${mode}' mode`);
    return true;
  } catch (error) {
    console.warn(`[auth] saveProgressToServer(${mode}) error:`, error);
    return false;
  }
}

export async function syncProgressForMode(mode) {
  const serverData = await fetchServerProgress(mode);
  if (!serverData) {
    console.log(`[auth] syncProgressForMode(${mode}): no server data, keeping local data`);
    return;
  }

  const hasServerHistory =
    serverData.progress != null || (serverData.scores && Object.keys(serverData.scores).length > 0);
  const localProgress = getStoredStageProgress(mode);
  const localScores = getStoredStageScores(mode);

  if (!hasServerHistory) {
    console.log(
      `[auth] syncProgressForMode(${mode}): no existing server history, uploading local data`,
      {
        localProgress,
        localScores,
      }
    );
    await saveProgressToServer(mode);
    return;
  }

  console.log(
    `[auth] syncProgressForMode(${mode}): existing server history found, loading into local`,
    {
      serverProgress: serverData.progress,
      serverScores: serverData.scores,
    }
  );
  setStoredStageProgress(serverData.progress || 1, mode);
  setStoredStageScores(serverData.scores || {}, mode);
}

export async function syncProgressToServerOnLogin() {
  for (const mode of SYNC_MODES) {
    await syncProgressForMode(mode);
  }
}
