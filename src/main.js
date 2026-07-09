import "./style.css";
import "./app.js";
import rough from "roughjs";
import { syncProgressToServerOnLogin, getIdToken } from "./auth.js";
import { buildApiUrl } from "./services/api.js";

/* global google */
window.addEventListener("load", () => {
  if (window.__delayLoadReady) {
    return;
  }
  if (!document.documentElement.classList.contains("js-ready")) {
    document.documentElement.classList.add("js-ready");
  }
  const loader = document.getElementById("page-loader");
  if (loader) loader.remove();
});

// --- Google Identity Services integration ---
// Public client ID (issued from Google Cloud Console)
const GOOGLE_CLIENT_ID = "529097378346-95i01gu1nmv8qcfrf459j0taep3t7vm6.apps.googleusercontent.com";

function renderAuthStatus(message, isError = false) {
  const container = document.getElementById("google-signin");
  if (!container) return;
  let status = container.querySelector(".auth-status-message");
  if (!status) {
    status = document.createElement("div");
    status.className = "auth-status-message";
    status.style.marginTop = "0.6rem";
    status.style.fontSize = "0.9rem";
    status.style.lineHeight = "1.3";
    status.style.color = isError ? "#c0392b" : "#4f3b24";
    container.appendChild(status);
  }
  status.textContent = message;
  status.style.color = isError ? "#c0392b" : "#4f3b24";
}

function showSignedIn(user) {
  const container = document.getElementById("google-signin");
  if (!container) return;
  container.innerHTML = "";
  const info = document.createElement("div");
  info.style.display = "flex";
  info.style.alignItems = "center";
  info.style.gap = "0.5rem";
  const label = document.createElement("span");
  label.textContent = user.name || user.email || "Signed in";
  const signOutBtn = document.createElement("button");
  signOutBtn.type = "button";
  signOutBtn.textContent = "Sign out";
  signOutBtn.addEventListener("click", () => {
    localStorage.removeItem("sketchy_user");
    renderSignInButton();
  });
  info.appendChild(label);
  container.appendChild(info);
  container.appendChild(signOutBtn);
}

function renderSignInButton() {
  const container = document.getElementById("google-signin");
  if (!container) return;
  container.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "google-signin-wrapper";

  const btn = document.createElement("button");
  btn.className = "google-signin-button";
  btn.type = "button";
  btn.textContent = "Log in";
  btn.setAttribute("aria-label", "Log in");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "google-signin-svg");
  svg.setAttribute("preserveAspectRatio", "none");

  wrapper.appendChild(svg);
  wrapper.appendChild(btn);
  container.appendChild(wrapper);

  const tryInit = () => {
    if (window.google && google.accounts && google.accounts.oauth2) {
      const codeClient = google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        ux_mode: "popup",
        callback: handleCodeResponse,
      });
      btn.addEventListener("click", () => {
        codeClient.requestCode();
      });
      drawRoughBorderAround(btn, svg);
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => drawRoughBorderAround(btn, svg));
        ro.observe(btn);
      } else {
        window.addEventListener("resize", () => drawRoughBorderAround(btn, svg));
      }
    } else {
      setTimeout(tryInit, 200);
    }
  };

  tryInit();
}

function drawRoughBorderAround(buttonEl, svgEl) {
  try {
    const rect = buttonEl.getBoundingClientRect();
    const width = Math.max(64, rect.width + 12);
    const height = Math.max(32, rect.height + 12);

    svgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svgEl.setAttribute("width", String(width));
    svgEl.setAttribute("height", String(height));

    // Clear existing children
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

    const rc = rough.svg(svgEl);
    const padding = 6;
    const rectEl = rc.rectangle(padding / 2, padding / 2, width - padding, height - padding, {
      stroke: "#4f3b24",
      strokeWidth: 1.6,
      roughness: 1.6,
      bowing: 1.2,
      fill: "transparent",
    });
    svgEl.appendChild(rectEl);
    // Position svg to wrap the button
    svgEl.style.width = `${rect.width + 12}px`;
    svgEl.style.height = `${rect.height + 12}px`;
    svgEl.style.left = `${-6}px`;
    svgEl.style.top = `${-6}px`;
  } catch (e) {
    // silent
    console.warn("drawRoughBorderAround failed", e);
  }
}

async function handleAuthCode(code) {
  if (!code) return;

  renderAuthStatus("로그인 인증 코드 처리 중…");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    console.log("[Auth] sending auth code to backend");
    const resp = await fetch(buildApiUrl("/api/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await resp.json();
    console.log("[Auth] auth response", resp.status, data);

    if (resp.ok && data && data.user) {
      const user = {
        id: data.user.id || data.user.sub,
        email: data.user.email,
        name: data.user.name,
        id_token: data.id_token || null,
      };
      localStorage.setItem("sketchy_user", JSON.stringify(user));
      showSignedIn(user);
      await syncProgressToServerOnLogin();
      return;
    }

    const errorMessage = data?.error || "Authentication failed.";
    console.warn("Auth failed", resp.status, errorMessage, data);
    renderAuthStatus("Login failed: " + errorMessage, true);
    renderSignInButton();
  } catch (err) {
    console.error("Auth error", err);
    const message =
      err.name === "AbortError"
        ? "Login timeout: backend did not respond."
        : "Login error: check console.";
    renderAuthStatus(message, true);
    renderSignInButton();
  }
}

async function handleCodeResponse(response) {
  console.log("[Auth] handleCodeResponse", response);
  if (!response) return;
  if (response.error) {
    console.warn("Google auth callback error", response.error);
    return;
  }
  if (response.code) {
    await handleAuthCode(response.code);
  }
}

// On load, show existing user or render sign-in
window.addEventListener("DOMContentLoaded", async () => {
  const raw = localStorage.getItem("sketchy_user");
  if (raw) {
    try {
      const u = JSON.parse(raw);
      showSignedIn(u);
      return;
    } catch (e) {
      localStorage.removeItem("sketchy_user");
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  if (code) {
    console.log("[Auth] found auth code in URL", code);
    await handleAuthCode(code);
    return;
  }

  renderSignInButton();
});
