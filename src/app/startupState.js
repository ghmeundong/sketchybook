export function shouldRevealStartPage({ backgroundLoaded, pageLoadComplete, fallbackTriggered }) {
  return fallbackTriggered || (backgroundLoaded && pageLoadComplete);
}
