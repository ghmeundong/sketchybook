import "./style.css";
import "./app.js";
import rough from "roughjs";

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
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
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
  // Create a positioned wrapper so we can draw a rough border around the
  // rendered Google button using an SVG overlay.
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";
  wrapper.style.verticalAlign = "middle";
  wrapper.id = "google-signin-wrapper";

  const btn = document.createElement("div");
  btn.id = "google-signin-button";
  btn.style.position = "relative";
  btn.style.zIndex = "2";

  // SVG overlay sits behind the button (zIndex 1) but above background
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.zIndex = "1";
  svg.setAttribute("preserveAspectRatio", "none");

  wrapper.appendChild(svg);
  wrapper.appendChild(btn);
  container.appendChild(wrapper);

  // Wait until the GIS script has loaded
  const tryInit = () => {
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        ux_mode: "popup",
      });
      google.accounts.id.renderButton(btn, { theme: "outline", size: "large" });
      // Draw rough border after the button renders
      setTimeout(() => drawRoughBorderAround(btn, svg), 150);
      // Redraw on resize
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => drawRoughBorderAround(btn, svg));
        ro.observe(btn);
      } else {
        window.addEventListener("resize", () => drawRoughBorderAround(btn, svg));
      }
    } else {
      // retry briefly
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

async function handleCredentialResponse(response) {
  if (!response || !response.credential) return;
  try {
    const resp = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: response.credential }),
    });
    const data = await resp.json();
    if (resp.ok && data && data.user) {
      // Persist minimal user info for UI
      const user = {
        id: data.user.id || data.user.sub,
        email: data.user.email,
        name: data.user.name,
        picture: data.user.picture,
      };
      localStorage.setItem("sketchy_user", JSON.stringify(user));
      showSignedIn(user);
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
