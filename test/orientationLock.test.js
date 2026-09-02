import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSafeLandscapeLockPromise, requestLandscapeMode } from "../src/app/orientationPrompt.js";

describe("mobile orientation lock", () => {
  beforeEach(() => {
    globalThis.document = {
      documentElement: {
        requestFullscreen: undefined,
        webkitRequestFullscreen: undefined,
      },
    };

    globalThis.screen = {
      orientation: {
        lock: vi.fn().mockResolvedValue(undefined),
      },
    };
  });

  it("tries the strongest landscape lock first and falls back safely", async () => {
    const lock = vi
      .fn()
      .mockRejectedValueOnce(new Error("primary blocked"))
      .mockResolvedValueOnce(undefined);

    globalThis.screen.orientation.lock = lock;

    await getSafeLandscapeLockPromise();

    expect(lock.mock.calls.map(([orientation]) => orientation)).toEqual([
      "landscape-primary",
      "landscape",
    ]);
  });

  it("requests landscape mode through the full user-gesture path", async () => {
    const lock = vi
      .fn()
      .mockRejectedValueOnce(new Error("primary blocked"))
      .mockResolvedValueOnce(undefined);
    globalThis.screen.orientation.lock = lock;

    await requestLandscapeMode();

    expect(lock.mock.calls.map(([orientation]) => orientation)).toEqual([
      "landscape-primary",
      "landscape",
    ]);
  });
});
