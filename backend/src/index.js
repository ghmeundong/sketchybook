const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

let localEnvVarsPromise = null;

function parseDotenv(content) {
  const vars = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

async function loadLocalEnvVars() {
  if (typeof process === "undefined" || !process.versions?.node) return {};
  try {
    const fs = await import("fs");
    const path = await import("path");
    const candidates = [".env", "../.env", "../../.env"];
    for (const candidate of candidates) {
      const filePath = path.resolve(process.cwd(), candidate);
      try {
        await fs.promises.access(filePath);
        const content = await fs.promises.readFile(filePath, "utf8");
        console.log(`[backend] loaded local env file: ${filePath}`);
        return parseDotenv(content);
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.warn("[backend] failed to load local .env fallback:", error);
  }
  return {};
}

function getLocalEnvVarsPromise() {
  if (!localEnvVarsPromise) {
    localEnvVarsPromise = loadLocalEnvVars();
  }
  return localEnvVarsPromise;
}

// 스케치북 컨셉에 맞춘 인메모리 저장소
let sketchbookMemory = {
  imageData: null, // Rough.js 캔버스 캡처 이미지 데이터
  vector: null, // 유저가 그린 선들의 좌표 및 물리 엔진용 데이터 배열
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message, status = 500) {
  return jsonResponse({ error: message }, status);
}

// 1. GET: 프론트엔드가 스케치북 데이터를 불러올 때
async function fetchSketchbook() {
  return sketchbookMemory;
}

// 2. POST: 프론트엔드에서 그린 새로운 스케치를 기록할 때
async function saveSketchbook(payload) {
  if (payload.imageData && typeof payload.imageData === "string") {
    sketchbookMemory.imageData = payload.imageData;
  }
  if (Array.isArray(payload.vector)) {
    sketchbookMemory.vector = payload.vector;
  }
  return { ok: true };
}

async function handleSketchRequest(request) {
  if (request.method === "GET") {
    const book = await fetchSketchbook();
    return jsonResponse({ imageData: book.imageData, vector: book.vector });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || (typeof body.imageData !== "string" && !Array.isArray(body.vector))) {
      return errorResponse("Request body must include imageData string or vector array.", 400);
    }

    await saveSketchbook({ imageData: body.imageData, vector: body.vector });
    return jsonResponse({ ok: true });
  }

  return new Response(null, {
    status: 405,
    headers: CORS_HEADERS,
  });
}

function getBearerToken(request) {
  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim();
}

async function handleProgressRequest(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  const idToken = getBearerToken(request);
  if (!idToken) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let payload;
  try {
    payload = await verifyIdToken(idToken, env);
  } catch (error) {
    return jsonResponse({ error: "Invalid auth token." }, 401);
  }

  const userSub = payload.sub;
  if (!userSub) {
    return jsonResponse({ error: "Invalid token payload." }, 401);
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "challenge" ? "challenge" : "normal";

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_sub TEXT,
      mode TEXT,
      progress INTEGER,
      scores TEXT,
      updated_at TEXT,
      UNIQUE(user_sub, mode)
    )`
  ).run();

  if (request.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT progress, scores FROM progress WHERE user_sub = ? AND mode = ?"
    )
      .bind(userSub, mode)
      .first();

    return jsonResponse({
      ok: true,
      mode,
      progress: row?.progress ?? null,
      scores: row?.scores ? JSON.parse(row.scores) : {},
    });
  }

  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.progress !== "number" ||
    typeof body.scores !== "object" ||
    body.scores === null
  ) {
    return errorResponse("Request body must include progress number and scores object.", 400);
  }

  const safeProgress = Math.min(30, Math.max(1, Math.floor(body.progress) || 1));
  const scoresJson = JSON.stringify(body.scores);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO progress (user_sub, mode, progress, scores, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_sub, mode) DO UPDATE SET
       progress = excluded.progress,
       scores = excluded.scores,
       updated_at = excluded.updated_at`
  )
    .bind(userSub, mode, safeProgress, scoresJson, now)
    .run();

  return jsonResponse({ ok: true, mode });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);

  // 1. 서버 연결 및 상태 확인용 헬스체크
  if (url.pathname === "/api/health") {
    return jsonResponse({
      ok: true,
      scope: "sketchybook-api",
      timestamp: new Date().toISOString(),
    });
  }

  // 2. 스케치북 그리기 데이터 교환 엔드포인트
  if (url.pathname === "/api/sketch") {
    try {
      return await handleSketchRequest(request, env);
    } catch (error) {
      return errorResponse(error.message || "Failed to handle sketchybook request.");
    }
  }

  // 3. Progress save/load endpoint for authenticated users
  if (url.pathname === "/api/progress") {
    try {
      return await handleProgressRequest(request, env);
    } catch (error) {
      return errorResponse(error.message || "Failed to handle progress request.");
    }
  }

  // 4. Google auth endpoint (POST { code } or { id_token })
  if (url.pathname === "/api/auth/google") {
    try {
      return await handleAuthRequest(request, env);
    } catch (error) {
      return errorResponse(error.message || "Failed to handle auth request.");
    }
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request, env) {
    // CORS Preflight 요청 처리
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }
    return handleRequest(request, env);
  },
};

// --- Auth handler: verify id_token and upsert user into D1 ---
async function getGoogleClientId(env) {
  if (env.GOOGLE_CLIENT_ID) return env.GOOGLE_CLIENT_ID;
  if (process.env.GOOGLE_CLIENT_ID) return process.env.GOOGLE_CLIENT_ID;
  const localVars = await getLocalEnvVarsPromise();
  return localVars.GOOGLE_CLIENT_ID || null;
}

async function getGoogleClientSecret(env) {
  if (env.GOOGLE_CLIENT_SECRET) return env.GOOGLE_CLIENT_SECRET;
  if (process.env.GOOGLE_CLIENT_SECRET) return process.env.GOOGLE_CLIENT_SECRET;
  const localVars = await getLocalEnvVarsPromise();
  return localVars.GOOGLE_CLIENT_SECRET || null;
}

async function handleAuthRequest(request, env) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => null);
  if (!body || (typeof body.code !== "string" && typeof body.id_token !== "string")) {
    return errorResponse("Request body must include code or id_token string.", 400);
  }

  let idToken;
  if (typeof body.code === "string") {
    idToken = await exchangeCodeForIdToken(body.code, env);
  } else {
    idToken = body.id_token;
  }

  const payload = await verifyIdToken(idToken, env);
  const sub = payload.sub;
  const email = payload.email || null;
  const name = payload.name || null;

  // Ensure users table exists
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, sub TEXT UNIQUE, email TEXT, name TEXT)`
  ).run();

  const existing = await env.DB.prepare("SELECT id, sub, email, name FROM users WHERE sub = ?")
    .bind(sub)
    .all();
  let user;
  if (existing && existing.results && existing.results.length) {
    user = existing.results[0];
    // Update if details changed
    if ((email && user.email !== email) || (name && user.name !== name)) {
      await env.DB.prepare("UPDATE users SET email = ?, name = ? WHERE sub = ?")
        .bind(email, name, sub)
        .run();
    }
  } else {
    const insert = await env.DB.prepare("INSERT INTO users (sub, email, name) VALUES (?, ?, ?)")
      .bind(sub, email, name)
      .run();
    const id = insert && insert.lastInsertRowId ? insert.lastInsertRowId : null;
    user = { id, sub, email, name };
  }

  return jsonResponse({ ok: true, user, id_token: idToken });
}

async function exchangeCodeForIdToken(code, env) {
  const clientId = await getGoogleClientId(env);
  const clientSecret = await getGoogleClientSecret(env);
  console.log(
    `[backend] exchangeCodeForIdToken using clientId=${clientId ? clientId.slice(0, 20) + "..." : "undefined"}`
  );
  if (!clientId) {
    throw new Error("Missing GOOGLE_CLIENT_ID in backend environment.");
  }

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: "postmessage",
  });
  if (clientSecret) {
    tokenParams.set("client_secret", clientSecret);
  }

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenParams.toString(),
  });

  if (!tokenResp.ok) {
    const errorPayload = await tokenResp.text().catch(() => "");
    console.error("[backend] Google token exchange failed:", tokenResp.status, errorPayload);
    throw new Error(`Authorization code exchange failed: ${errorPayload}`);
  }

  const tokenData = await tokenResp.json();
  if (!tokenData.id_token) {
    throw new Error("Token exchange did not return an id_token.");
  }

  return tokenData.id_token;
}

async function verifyIdToken(idToken, env) {
  const tokenResp = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  if (!tokenResp.ok) {
    throw new Error("Invalid id_token.");
  }

  const payload = await tokenResp.json();
  const expectedAud = await getGoogleClientId(env);
  if (expectedAud && payload.aud !== expectedAud) {
    throw new Error(`Token audience mismatch. Expected ${expectedAud}, got ${payload.aud}`);
  }

  return payload;
}
