const DRAWING_AUDIO_LOOP_START = 0.37;
const DRAWING_AUDIO_LOOP_END = 0.53;
const DRAWING_AUDIO_IDLE_DELAY = 80;
const DRAWING_AUDIO_START_VOLUME = 0.12;
const DRAWING_AUDIO_SPEED_DEAD_ZONE = 35;
const DRAWING_AUDIO_MIN_VOLUME = 0.12;
const DRAWING_AUDIO_MAX_VOLUME = 0.72;
const DRAWING_AUDIO_SPEED_RANGE = 700;

export function createDrawingAudioController({ audioUrl, getSfxVolume }) {
  const audio = new Audio(audioUrl);
  audio.preload = "auto";
  audio.volume = 0;

  let loopTimer = null;
  let idleTimer = null;
  let motionActive = false;
  let baseVolume = 0;
  let lastPoint = null;
  let lastTime = 0;

  function getDuration() {
    return Number.isFinite(audio.duration) ? audio.duration : 1.1;
  }

  function getTime(fraction) {
    return getDuration() * fraction;
  }

  function setVolumeForSpeed(speed = 0) {
    if (speed <= DRAWING_AUDIO_SPEED_DEAD_ZONE) {
      baseVolume = 0;
      audio.volume = 0;
      return;
    }

    const normalizedSpeed = Math.min(
      1,
      (speed - DRAWING_AUDIO_SPEED_DEAD_ZONE) / DRAWING_AUDIO_SPEED_RANGE
    );
    const speedVolume =
      DRAWING_AUDIO_MIN_VOLUME +
      (DRAWING_AUDIO_MAX_VOLUME - DRAWING_AUDIO_MIN_VOLUME) * normalizedSpeed ** 1.1;
    baseVolume = speedVolume;
    audio.volume = speedVolume * getSfxVolume();
  }

  function scheduleIdleStop() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => {
      motionActive = false;
      audio.pause();
      audio.volume = 0;
      idleTimer = null;
    }, DRAWING_AUDIO_IDLE_DELAY);
  }

  function stop() {
    if (loopTimer) clearInterval(loopTimer);
    if (idleTimer) clearTimeout(idleTimer);
    loopTimer = null;
    idleTimer = null;
    motionActive = false;
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0;
    baseVolume = 0;
    lastPoint = null;
    lastTime = 0;
  }

  function start(startPoint = null) {
    stop();
    motionActive = true;
    baseVolume = DRAWING_AUDIO_START_VOLUME;
    lastPoint = startPoint;
    lastTime = startPoint ? performance.now() : 0;
    audio.currentTime = getTime(DRAWING_AUDIO_LOOP_START);
    audio.volume = DRAWING_AUDIO_START_VOLUME * getSfxVolume();
    void audio.play().catch(() => {});
    loopTimer = window.setInterval(() => {
      if (!motionActive) return;
      if (audio.paused) {
        audio.currentTime = getTime(DRAWING_AUDIO_LOOP_START);
        void audio.play().catch(() => {});
      }
      if (audio.currentTime >= getTime(DRAWING_AUDIO_LOOP_END)) {
        audio.currentTime = getTime(DRAWING_AUDIO_LOOP_START);
      }
    }, 10);
  }

  function update(point) {
    const now = performance.now();
    if (lastPoint && lastTime) {
      const elapsed = Math.max(1, now - lastTime);
      const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
      setVolumeForSpeed((distance / elapsed) * 1000);
    }
    motionActive = true;
    scheduleIdleStop();
    lastPoint = point;
    lastTime = now;
  }

  function playTail() {
    audio.pause();
    audio.currentTime = getTime(DRAWING_AUDIO_LOOP_END);
    audio.volume = getSfxVolume();
    void audio.play().catch(() => {});
  }

  function updateVolume(sfxVolume) {
    if (Number.isFinite(sfxVolume) && motionActive) {
      audio.volume = baseVolume * sfxVolume;
    }
  }

  window.addEventListener("sketchybook:sfx-volume-committed", playTail);
  window.addEventListener("sketchybook:audio-settings-change", (event) => {
    updateVolume(event.detail?.sfx);
  });

  return { start, stop, update, playTail };
}
