import { afterEach, describe, expect, it, vi } from "vitest";
import { createDrawingAudioController } from "../src/game/audio/drawingAudio.js";

class FakeAudio {
  constructor(url) {
    FakeAudio.lastInstance = this;
    this.url = url;
    this.duration = 1;
    this.currentTime = 0;
    this.volume = 0;
    this.paused = true;
    this.play = vi.fn(() => {
      this.paused = false;
      return Promise.resolve();
    });
    this.pause = vi.fn(() => {
      this.paused = true;
    });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createDrawingAudioController", () => {
  it("starts and stops the drawing audio loop", () => {
    const eventListeners = {};
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal("window", {
      addEventListener: (name, handler) => {
        eventListeners[name] = handler;
      },
      setInterval: vi.fn(() => 1),
      setTimeout: vi.fn(),
    });
    vi.stubGlobal("clearInterval", vi.fn());
    vi.stubGlobal("clearTimeout", vi.fn());

    const controller = createDrawingAudioController({
      audioUrl: "drawing.wav",
      getSfxVolume: () => 0.5,
    });

    controller.start();
    const audio = FakeAudio.lastInstance;

    expect(audio.url).toBe("drawing.wav");
    expect(audio.play).toHaveBeenCalled();
    expect(eventListeners["sketchybook:sfx-volume-committed"]).toBeTypeOf("function");

    controller.stop();
    expect(globalThis.clearInterval).toHaveBeenCalled();
  });
});
