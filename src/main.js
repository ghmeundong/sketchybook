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

async function handleCodeResponse(response) {
  if (!response || !response.code) return;
  try {
    const resp = await fetch(buildApiUrl("/api/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: response.code }),
    });
    const data = await resp.json();
    if (resp.ok && data && data.user) {
      const user = {
        id: data.user.id || data.user.sub,
        email: data.user.email,
        name: data.user.name,
        id_token: response.id_token || null,
      };
      localStorage.setItem("sketchy_user", JSON.stringify(user));
      showSignedIn(user);
      await syncProgressToServerOnLogin();
    } else {
      console.warn("Auth failed", data);
      renderSignInButton();
    }
  } catch (err) {
    console.error("Auth error", err);
    renderSignInButton();
  }
}

// On load, show existing user or render sign-in
window.addEventListener("DOMContentLoaded", () => {
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
  renderSignInButton();
});
