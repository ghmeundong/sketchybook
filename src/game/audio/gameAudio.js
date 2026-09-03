import backgroundMusicUrl from "../../assets/audio/Brain-Teaser-2.ogg";
import stageClearSoundUrl from "../../assets/sounds/conventional-postage-stamp.mp3";
import starCollectSoundUrl from "../../assets/sounds/liecio-achive-sound-132273.mp3";
import scoreStarSoundUrl from "../../assets/sounds/driken5482-retro-coin-4-236671.mp3";
import { getMusicVolume, getSfxVolume } from "../../app/audioSettings.js";
import { dom } from "../engine/core/domRefs.js";
import { state } from "../engine/core/gameState.js";

const BACKGROUND_MUSIC_VOLUME = 1;
const BACKGROUND_MUSIC_FADE_IN_DURATION = 450;
const BACKGROUND_MUSIC_FADE_OUT_DURATION = 1800;

export const backgroundMusic = new Audio(backgroundMusicUrl);
backgroundMusic.loop = true;
backgroundMusic.preload = "auto";
backgroundMusic.volume = BACKGROUND_MUSIC_VOLUME * getMusicVolume();
backgroundMusic.muted = true;

let backgroundMusicFadeFrame = null;
let backgroundMusicFadeTarget = null;
let backgroundMusicTransitionId = 0;
let backgroundMusicPlaybackRequestId = 0;
let backgroundMusicEntryCheckTimer = null;
let backgroundMusicRetryTimer = null;

export function requestBackgroundMusicPlayback(force = false) {
  if (backgroundMusic.volume <= 0 && !force) {
    return;
  }

  const playbackRequestId = ++backgroundMusicPlaybackRequestId;
  backgroundMusic.muted = false;
  const playPromise = backgroundMusic.play();
  playPromise
    ?.then(() => {
      if (playbackRequestId !== backgroundMusicPlaybackRequestId) {
        backgroundMusic.pause();
        return;
      }
      backgroundMusic.muted = false;
      if (backgroundMusicRetryTimer) {
        clearTimeout(backgroundMusicRetryTimer);
        backgroundMusicRetryTimer = null;
      }
    })
    .catch(() => {
      if (playbackRequestId !== backgroundMusicPlaybackRequestId) return;
      const retryDelay = 600;
      if (backgroundMusicRetryTimer) {
        clearTimeout(backgroundMusicRetryTimer);
      }
      backgroundMusicRetryTimer = window.setTimeout(() => {
        backgroundMusicRetryTimer = null;
        if (getMusicVolume() > 0) {
          requestBackgroundMusicPlayback(true);
        }
      }, retryDelay);
    });
}

requestBackgroundMusicPlayback(true);

function fadeBackgroundMusic(targetVolume, duration) {
  const nextVolume = Math.max(0, Math.min(BACKGROUND_MUSIC_VOLUME, targetVolume));
  if (
    Math.abs(backgroundMusic.volume - nextVolume) < 0.001 &&
    (nextVolume === 0 ? backgroundMusic.paused : !backgroundMusic.paused)
  ) {
    return;
  }
  const startVolume = backgroundMusic.volume;
  if (backgroundMusicFadeFrame) cancelAnimationFrame(backgroundMusicFadeFrame);
  const transitionId = ++backgroundMusicTransitionId;
  backgroundMusicFadeTarget = nextVolume;

  if (nextVolume > 0 && backgroundMusic.paused) {
    requestBackgroundMusicPlayback();
  }

  const startTime = performance.now();
  const updateVolume = (timestamp) => {
    if (transitionId !== backgroundMusicTransitionId) return;
    const progress = Math.min(1, (timestamp - startTime) / duration);
    backgroundMusic.volume = startVolume + (nextVolume - startVolume) * progress;
    if (progress < 1) {
      backgroundMusicFadeFrame = requestAnimationFrame(updateVolume);
      return;
    }

    backgroundMusicFadeFrame = null;
    backgroundMusicFadeTarget = null;
    if (nextVolume === 0) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
  };

  backgroundMusicFadeFrame = requestAnimationFrame(updateVolume);
}

export function syncBackgroundMusicForPage(page) {
  const isGamePage = page === dom.playPage;
  if (isGamePage) {
    if (backgroundMusicFadeFrame) cancelAnimationFrame(backgroundMusicFadeFrame);
    backgroundMusicFadeFrame = null;
    backgroundMusicTransitionId += 1;
    backgroundMusicPlaybackRequestId += 1;
    backgroundMusicFadeTarget = null;
    fadeBackgroundMusic(0, BACKGROUND_MUSIC_FADE_OUT_DURATION);
    return;
  }
  if (!isGamePage) {
    backgroundMusic.muted = false;
    requestBackgroundMusicPlayback();
  }
  fadeBackgroundMusic(
    isGamePage ? 0 : BACKGROUND_MUSIC_VOLUME * getMusicVolume(),
    isGamePage ? BACKGROUND_MUSIC_FADE_OUT_DURATION : BACKGROUND_MUSIC_FADE_IN_DURATION
  );
}

export function unlockBackgroundMusic() {
  if (getMusicVolume() <= 0) {
    backgroundMusic.pause();
    return;
  }

  backgroundMusic.muted = false;
  requestBackgroundMusicPlayback(true);

  if (!dom.playPage?.classList.contains("is-active")) {
    fadeBackgroundMusic(
      BACKGROUND_MUSIC_VOLUME * getMusicVolume(),
      BACKGROUND_MUSIC_FADE_IN_DURATION
    );
  }
}

export function setActiveAudioPage(page) {
  if (backgroundMusicEntryCheckTimer) {
    clearTimeout(backgroundMusicEntryCheckTimer);
    backgroundMusicEntryCheckTimer = null;
  }
  if (page === dom.playPage) {
    state.gamePageFirstRenderVerified = false;
    backgroundMusicEntryCheckTimer = window.setTimeout(() => {
      backgroundMusicEntryCheckTimer = null;
      if (state.activeAudioPage === dom.playPage) syncBackgroundMusicForPage(dom.playPage);
    }, BACKGROUND_MUSIC_FADE_IN_DURATION);
  }
  state.activeAudioPage = page;
  syncBackgroundMusicForPage(page);
}

export const stageClearAudio = new Audio(stageClearSoundUrl);
stageClearAudio.preload = "auto";
stageClearAudio.volume = getSfxVolume();
stageClearAudio.load();
export const starCollectAudio = new Audio(starCollectSoundUrl);
starCollectAudio.preload = "auto";
starCollectAudio.volume = getSfxVolume();
starCollectAudio.load();

window.addEventListener("sketchybook:audio-settings-change", (event) => {
  const settings = event.detail || {};
  if (Number.isFinite(settings.sfx)) {
    stageClearAudio.volume = settings.sfx;
    starCollectAudio.volume = settings.sfx;
  }
  const isGamePage = dom.playPage?.classList.contains("is-active");
  if (!isGamePage && Number.isFinite(settings.music)) {
    if (backgroundMusicFadeFrame) cancelAnimationFrame(backgroundMusicFadeFrame);
    backgroundMusicFadeFrame = null;
    backgroundMusicTransitionId += 1;
    backgroundMusicFadeTarget = null;
    backgroundMusic.volume = settings.music;
    backgroundMusic.muted = false;
    if (settings.music > 0) {
      requestBackgroundMusicPlayback();
    } else {
      backgroundMusic.pause();
    }
  }
});

export function unlockStageClearSound() {
  if (!stageClearAudio.paused) return;
  const originalVolume = stageClearAudio.volume;
  stageClearAudio.volume = 0;
  const unlockPromise = stageClearAudio.play();
  if (!unlockPromise) {
    stageClearAudio.volume = originalVolume;
    return;
  }
  unlockPromise
    .then(() => {
      stageClearAudio.pause();
      stageClearAudio.currentTime = 0;
      stageClearAudio.volume = originalVolume;
    })
    .catch(() => {
      stageClearAudio.volume = originalVolume;
    });
}

export function playStageClearSound() {
  const audio = new Audio(stageClearSoundUrl);
  audio.preload = "auto";
  audio.volume = getSfxVolume();
  const playPromise = audio.play();
  playPromise?.catch((error) => {
    console.warn("Stage clear sound playback failed:", error);
  });
}

export function playStarCollectSound() {
  const audio = new Audio(starCollectSoundUrl);
  audio.preload = "auto";
  audio.volume = getSfxVolume();
  audio.currentTime = 0.11;
  void audio.play().catch(() => {});
}

export function playScoreStarSound() {
  const audio = new Audio(scoreStarSoundUrl);
  audio.preload = "auto";
  audio.volume = getSfxVolume();
  void audio.play().catch(() => {});
}

export function verifyGamePageMusicAfterFirstRender(isGameActive) {
  if (!isGameActive || state.gamePageFirstRenderVerified) return;
  syncBackgroundMusicForPage(dom.playPage);
  state.gamePageFirstRenderVerified = true;
}
