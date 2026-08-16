/**
 * 게임 난이도 레벨 정의 및 필터링 로직
 */

export const DIFFICULTY_LEVELS = {
  EASY: "easy",
  NORMAL: "normal",
  HARD: "hard",
  INSANE: "insane",
};

export const DIFFICULTY_CONFIG = {
  [DIFFICULTY_LEVELS.EASY]: {
    id: "easy",
    name: "Easy",
    order: 0,
    hasFloor: true,
    canDrawOnBall: true,
    enableChallengeMode: false,
    maxLineLength: null, // 제한 없음
    description: "Learning mode",
    summary: "Floor on / easy draw / challenge mode unavailable / no line limit",
  },
  [DIFFICULTY_LEVELS.NORMAL]: {
    id: "normal",
    name: "Normal",
    order: 1,
    hasFloor: true,
    canDrawOnBall: true,
    enableChallengeMode: false,
    maxLineLength: 5000,
    description: "Standard mode",
    summary: "Floor on / normal draw / challenge mode unavailable / line limit 5000px",
  },
  [DIFFICULTY_LEVELS.HARD]: {
    id: "hard",
    name: "Hard",
    order: 2,
    hasFloor: false,
    canDrawOnBall: false,
    enableChallengeMode: true,
    maxLineLength: 2500,
    description: "No safety net",
    summary: "Floor off / no ball drawing / challenge mode available / line limit 2500px",
  },
  [DIFFICULTY_LEVELS.INSANE]: {
    id: "insane",
    name: "Insane",
    order: 3,
    hasFloor: false,
    canDrawOnBall: false,
    enableChallengeMode: true,
    maxLineLength: 1250,
    description: "Maximum difficulty",
    summary:
      "Floor off / no ball drawing / no platform drawing / challenge mode available / line limit 1250px",
  },
};

/**
 * 주어진 난이도에 대해 오브젝트가 표시되어야 하는지 확인
 * @param {Object} gameObject - 게임 오브젝트
 * @param {string} currentDifficulty - 현재 난이도
 * @returns {boolean}
 */
export function shouldObjectAppear(gameObject, currentDifficulty) {
  if (!gameObject || !currentDifficulty) {
    return true; // 기본값은 모든 난이도에서 표시
  }

  // levels 속성이 없으면 모든 난이도에서 표시
  if (!gameObject.levels) {
    return true;
  }

  // levels가 배열이면 해당 난이도가 포함되는지 확인
  if (Array.isArray(gameObject.levels)) {
    return gameObject.levels.includes(currentDifficulty);
  }

  // levels가 문자열이면 정확히 일치하는지 확인
  if (typeof gameObject.levels === "string") {
    return gameObject.levels === currentDifficulty;
  }

  return true;
}

/**
 * 난이도에 따라 오브젝트 배열을 필터링
 * @param {Array} objects - 원본 오브젝트 배열
 * @param {string} difficulty - 난이도
 * @returns {Array} 필터링된 오브젝트 배열
 */
export function filterObjectsByDifficulty(objects, difficulty) {
  if (!Array.isArray(objects)) {
    return [];
  }

  return objects.filter((obj) => shouldObjectAppear(obj, difficulty));
}

/**
 * 난이도별 게임 규칙 적용
 * @param {Object} gameState - 게임 상태
 * @param {string} difficulty - 난이도
 * @returns {Object} 적용된 게임 규칙
 */
export function getDifficultyRules(difficulty) {
  const config = DIFFICULTY_CONFIG[difficulty];
  if (!config) {
    return DIFFICULTY_CONFIG[DIFFICULTY_LEVELS.NORMAL];
  }
  return config;
}

/**
 * 난이도 목록을 순서대로 반환
 * @returns {Array} 난이도 배열
 */
export function getDifficultyList() {
  return Object.values(DIFFICULTY_LEVELS).sort(
    (a, b) => DIFFICULTY_CONFIG[a].order - DIFFICULTY_CONFIG[b].order
  );
}

/**
 * 다음 난이도 반환
 * @param {string} currentDifficulty
 * @returns {string} 다음 난이도
 */
export function getNextDifficulty(currentDifficulty) {
  const list = getDifficultyList();
  const currentIndex = list.indexOf(currentDifficulty);
  if (currentIndex === -1 || currentIndex === list.length - 1) {
    return list[0]; // 마지막이면 처음으로
  }
  return list[currentIndex + 1];
}

/**
 * 이전 난이도 반환
 * @param {string} currentDifficulty
 * @returns {string} 이전 난이도
 */
export function getPreviousDifficulty(currentDifficulty) {
  const list = getDifficultyList();
  const currentIndex = list.indexOf(currentDifficulty);
  if (currentIndex === -1 || currentIndex === 0) {
    return list[list.length - 1]; // 처음이면 마지막으로
  }
  return list[currentIndex - 1];
}
