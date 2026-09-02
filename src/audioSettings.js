const AUDIO_SETTINGS_KEY = "sketchybook-audio-settings";
const DEFAULT_AUDIO_SETTINGS = { music: 1, sfx: 1 };

function readAudioSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(AUDIO_SETTINGS_KEY) || "{}");
    return {
      music: Number.isFinite(stored.music) ? Math.min(1, Math.max(0, stored.music)) : 1,
      sfx: Number.isFinite(stored.sfx) ? Math.min(1, Math.max(0, stored.sfx)) : 1,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

let audioSettings = readAudioSettings();

export function getAudioSettings() {
  return { ...audioSettings };
}

export function setAudioSettings(changes) {
  audioSettings = {
    music: Number.isFinite(changes.music)
      ? Math.min(1, Math.max(0, changes.music))
      : audioSettings.music,
    sfx: Number.isFinite(changes.sfx) ? Math.min(1, Math.max(0, changes.sfx)) : audioSettings.sfx,
  };
  localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(audioSettings));
  window.dispatchEvent(
    new CustomEvent("sketchybook:audio-settings-change", { detail: getAudioSettings() })
  );
  return getAudioSettings();
}

export function getMusicVolume() {
  return audioSettings.music;
}

export function getSfxVolume() {
  return audioSettings.sfx;
}
