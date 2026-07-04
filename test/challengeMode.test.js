import { describe, expect, it } from "vitest";
import {
  CHALLENGE_MODE_STORAGE_KEY,
  getChallengeModePreference,
  setChallengeModePreference,
} from "../src/game/challengeMode.js";

function createStorage(initialValue = null) {
  const store = new Map();
  if (initialValue !== null) {
    store.set(CHALLENGE_MODE_STORAGE_KEY, String(initialValue));
  }
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

describe("challenge mode preferences", () => {
  it("reads and writes the challenge mode flag from storage", () => {
    const storage = createStorage();

    expect(getChallengeModePreference(storage)).toBe(false);

    setChallengeModePreference(true, storage);
    expect(getChallengeModePreference(storage)).toBe(true);

    setChallengeModePreference(false, storage);
    expect(getChallengeModePreference(storage)).toBe(false);
  });
});
