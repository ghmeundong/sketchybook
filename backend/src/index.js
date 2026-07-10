const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// 스케치북 컨셉에 맞춘 인메모리 저장소
let sketchbookMemory = {
  imageData: null,
  vector: null,
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

async function fetchSketchbook() {
  return sketchbookMemory;
}

async function saveSketchbook(payload) {
  if (payload.imageData && typeof payload.imageData === "string") {
    sketchbookMemory.imageData = payload.imageData;
  }
  if (Array.isArray(payload.vector)) {
    sketchbookMemory.vector = payload.vector;
  }
  return { ok: true };
}

// 1. 스케치 전용 핸들러 (env 매개변수 추가로 싱크 매칭)
async function handleSketchRequest(request, env) {
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

// 2. 진행도 및 베스트 스코어 핸들러 (병합 최적화 로직 포함)
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

  // 기존 DB 데이터 조회 및 베스트 스코어 비교 병합
  const existingRow = await env.DB.prepare(
    "SELECT progress, scores FROM progress WHERE user_sub = ? AND mode = ?"
  )
    .bind(userSub, mode)
    .first();

  let finalProgress = Math.min(30, Math.max(1, Math.floor(body.progress) || 1));
  let finalScores = body.scores || {};

  if (existingRow) {
    finalProgress = Math.max(finalProgress, existingRow.progress || 1);

    let existingScores = {};
    try {
      existingScores = JSON.parse(existingRow.scores || "{}");
    } catch (error) {
      console.error("[backend] JSON parse error:", error);
    }

    const allStageKeys = new Set([...Object.keys(existingScores), ...Object.keys(finalScores)]);
    const mergedScores = {};

    for (const stage of allStageKeys) {
      const oldScore = existingScores[stage];
      const newScore = finalScores[stage];

      if (oldScore !== undefined && newScore !== undefined) {
        mergedScores[stage] = Math.min(oldScore, newScore);
      } else {
        mergedScores[stage] = oldScore !== undefined ? oldScore : newScore;
      }
    }
    finalScores = mergedScores;
  }

  const scoresJson = JSON.stringify(finalScores);
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO progress (user_sub, mode, progress, scores, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_sub, mode) DO UPDATE SET
       progress = excluded.progress,
       scores = excluded.scores,
       updated_at = excluded.updated_at`
  )
    .bind(userSub, mode, finalProgress, scoresJson, now)
    .run();

  return jsonResponse({ ok: true, mode });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === "/api/health") {
    return jsonResponse({
      ok: true,
      scope: "sketchybook-api",
      timestamp: new Date().toISOString(),
    });
  }

  if (url.pathname === "/api/sketch") {
    try {
      return await handleSketchRequest(request, env);
    } catch (error) {
      console.error("[backend] handleSketchRequest error:", error);
      return errorResponse(error.message || "Failed to handle sketchybook request.");
    }
  }

  if (url.pathname === "/api/progress") {
    try {
      return await handleProgressRequest(request, env);
    } catch (error) {
      console.error("[backend] handleProgressRequest error:", error);
      return errorResponse(error.message || "Failed to handle progress request.");
    }
  }

  if (url.pathname === "/api/auth/google") {
    try {
      return await handleAuthRequest(request, env);
    } catch (error) {
      console.error("[backend] handleAuthRequest error:", error);
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
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }
    return handleRequest(request, env);
  },
};

function getGoogleClientId(env) {
  return env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || null;
}

function getGoogleClientSecret(env) {
  return env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || null;
}

async function handleAuthRequest(request, env) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => null);
  console.log("[backend] handleAuthRequest body:", body);
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

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, sub TEXT UNIQUE, email TEXT, name TEXT)`
  ).run();

  const existing = await env.DB.prepare("SELECT id, sub, email, name FROM users WHERE sub = ?")
    .bind(sub)
    .all();
  let user;
  if (existing && existing.results && existing.results.length) {
    user = existing.results[0];
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
  const clientId = getGoogleClientId(env);
  const clientSecret = getGoogleClientSecret(env);
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
  const expectedAud = getGoogleClientId(env);
  if (expectedAud && payload.aud !== expectedAud) {
    throw new Error(`Token audience mismatch. Expected ${expectedAud}, got ${payload.aud}`);
  }

  return payload;
}
