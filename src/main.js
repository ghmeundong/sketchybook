import "./style.css";
import "./app.js";

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
