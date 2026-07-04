const CHALLENGE_MODE_STORAGE_KEY = "sketchybook.challengeMode";

function readStoredBoolean(storage, key) {
  const rawValue = storage?.getItem?.(key);
  if (rawValue == null) {
    return false;
  }

  return rawValue === "true" || rawValue === "1";
}

function writeStoredBoolean(storage, key, value) {
  if (!storage?.setItem) {
    return;
  }

  storage.setItem(key, value ? "true" : "false");
}

function getChallengeModePreference(storage = globalThis.localStorage) {
  return readStoredBoolean(storage, CHALLENGE_MODE_STORAGE_KEY);
}

function setChallengeModePreference(enabled, storage = globalThis.localStorage) {
  writeStoredBoolean(storage, CHALLENGE_MODE_STORAGE_KEY, enabled);
  return enabled;
}

export { CHALLENGE_MODE_STORAGE_KEY, getChallengeModePreference, setChallengeModePreference };
