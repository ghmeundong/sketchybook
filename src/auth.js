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
    console.log(`[auth] syncProgressForMode(${mode}): 서버 데이터가 없거나 로드 실패, 로컬 유지`);
    return;
  }

  const localProgress = getStoredStageProgress(mode) || 1;
  const localScores = getStoredStageScores(mode) || {};

  const hasServerHistory =
    serverData.progress != null || (serverData.scores && Object.keys(serverData.scores).length > 0);

  // 1. 서버에 데이터가 아예 새것 상태라면 -> 로컬 데이터를 서버로 즉시 백업
  if (!hasServerHistory) {
    console.log(
      `[auth] syncProgressForMode(${mode}): 서버 기록이 비어 있음. 로컬 백업을 업로드합니다.`
    );
    await saveProgressToServer(mode);
    return;
  }

  // 2. 서버 기록이 존재할 때: 로컬 데이터와 안전하게 상호 병합(Merge) 진행
  const serverProgress = serverData.progress || 1;
  const serverScores = serverData.scores || {};

  // 더 높은 스테이지 진척도 선택
  const mergedProgress = Math.max(localProgress, serverProgress);

  // 각 스테이지별 최소 선 획수(Best Score) 골라내기
  const mergedScores = { ...serverScores };
  let localIsBetter = false;

  for (const [stage, localScore] of Object.entries(localScores)) {
    const serverScore = serverScores[stage];
    if (serverScore !== undefined) {
      if (localScore < serverScore) {
        mergedScores[stage] = localScore; // 로컬 기록이 더 우수함
        localIsBetter = true;
      }
    } else {
      // 서버엔 없는 판정 스코어가 로컬에만 존재할 때
      mergedScores[stage] = localScore;
      localIsBetter = true;
    }
  }

  // 최종 조율된 데이터를 로컬 스토리지에 확정 보관
  setStoredStageProgress(mergedProgress, mode);
  setStoredStageScores(mergedScores, mode);

  // 만약 내 기기(로컬)의 스테이지 클리어 기록이 서버보다 높았거나 더 좋은 스코어가 있었다면 서버에도 동기화 갱신
  if (localProgress > serverProgress || localIsBetter) {
    console.log(`[auth] 기기의 우수한 기록을 서버 데이터베이스에 반영합니다.`);
    await saveProgressToServer(mode);
  } else {
    console.log(`[auth] 서버 동기화 완료: 서버 데이터가 최신이거나 동일합니다.`);
  }
}

export async function syncProgressToServerOnLogin() {
  for (const mode of SYNC_MODES) {
    await syncProgressForMode(mode);
  }
}
