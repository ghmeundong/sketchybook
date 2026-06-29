const DEFAULT_LOCAL = "http://localhost:8787";
let API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_LOCAL;

if (typeof window !== "undefined") {
  const host = window.location.hostname || "";

  if (
    API_BASE_URL === DEFAULT_LOCAL ||
    /localhost/.test(API_BASE_URL) ||
    host.endsWith(".github.dev")
  ) {
    if (host.endsWith(".github.dev")) {
      // remove possible '-5173' or other suffixes and build Codespaces backend host
      const baseHost = host.replace(/-\d+$/, "").replace(".github.dev", "").replace(".app", "");
      API_BASE_URL = `https://${baseHost}-8787.app.github.dev`;
    } else if (host.endsWith(".github.io")) {
      API_BASE_URL = import.meta.env.VITE_API_URL || DEFAULT_LOCAL;
    }
  }
}

export const api = {
  health: async () => {
    const url = `${API_BASE_URL.replace(/\/$/, "")}/api/health`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API health check failed: ${res.status}`);
    return res.json();
  },
};
