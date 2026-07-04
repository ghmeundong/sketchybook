const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

async function handleRequest(request) {
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
      return await handleSketchRequest(request);
    } catch (error) {
      return errorResponse(error.message || "Failed to handle sketchybook request.");
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
  async fetch(request) {
    // CORS Preflight 요청 처리
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }
    return handleRequest(request);
  },
};
