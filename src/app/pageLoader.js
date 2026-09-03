// Removes the splash/page loader once the window has fully loaded.
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
