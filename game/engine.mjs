export const SAVE_KEY = 'cs.notes.stackraid.v1';
export const ACTIVE_KEY = 'cs.notes.stackraid.run.v1';
export const SAVE_VERSION = 1;

export const UPGRADES = Object.freeze({
  shield: {
    id: 'shield',
    name: 'Mutex Shield',
    description: 'Ignore the next integrity hit.',
  },
  extraTime: {
    id: 'extraTime',
    name: 'Clock Cycle+',
    description: 'Add 8 seconds to every remaining encounter.',
  },
  eliminate: {
    id: 'eliminate',
    name: 'Breakpoint',
    description: 'Hide one wrong option in each remaining choice encounter.',
  },
  comboGuard: {
    id: 'comboGuard',
    name: 'Green Pipeline',
    description: 'Keep your combo through the next mistake.',
  },
});

export function createDefaultSave() {
  return {
    version: SAVE_VERSION,
    mastery: {},
    completedRuns: 0,
    personalBests: { mixed: 0, comp1521: 0, comp1531: 0 },
    unlocks: [],
    settings: { sound: false, reducedMotion: false },
    dailyHistory: {},
  };
}

export function normalizeSave(value) {
  const base = createDefaultSave();
  if (!value || typeof value !== 'object') return base;
  const input = value.version === SAVE_VERSION ? value : {};
  const mastery = {};
  if (input.mastery && typeof input.mastery === 'object') {
    for (const [topic, record] of Object.entries(input.mastery)) {
      if (!record || typeof record !== 'object') continue;
      mastery[topic] = {
        value: clampNumber(record.value, 0, 100, 0),
        attempts: clampInteger(record.attempts, 0, 1_000_000, 0),
        correct: clampInteger(record.correct, 0, 1_000_000, 0),
        lastResult: record.lastResult === 'correct' ? 'correct' : record.lastResult === 'wrong' ? 'wrong' : null,
      };
    }
  }
  return {
    version: SAVE_VERSION,
    mastery,
    completedRuns: clampInteger(input.completedRuns, 0, 1_000_000, 0),
    personalBests: {
      mixed: clampInteger(input.personalBests?.mixed, 0, 1_000_000_000, 0),
      comp1521: clampInteger(input.personalBests?.comp1521, 0, 1_000_000_000, 0),
      comp1531: clampInteger(input.personalBests?.comp1531, 0, 1_000_000_000, 0),
    },
    unlocks: Array.isArray(input.unlocks) ? input.unlocks.filter((item) => typeof item === 'string').slice(0, 100) : [],
    settings: {
      sound: input.settings?.sound === true,
      reducedMotion: input.settings?.reducedMotion === true,
    },
    dailyHistory: input.dailyHistory && typeof input.dailyHistory === 'object' ? { ...input.dailyHistory } : {},
  };
}

export function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed) {
  let state = seed >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailySeed(date = new Date(), course = 'mixed') {
  const day = typeof date === 'string' ? date : localDateKey(date);
  return hashSeed(`stackraid:${day}:${course}`);
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function selectRunChallenges(pool, { course = 'mixed', seed = 1, mastery = {} } = {}) {
  const rng = createRng(seed);
  const picked = new Set();
  const result = [];
  const firstCourse = rng() < 0.5 ? 'comp1521' : 'comp1531';
  const desiredCourses = Array.from({ length: 12 }, (_, index) => {
    if (course !== 'mixed') return course;
    return index % 2 === 0 ? firstCourse : otherCourse(firstCourse);
  });

  for (let index = 0; index < 12; index += 1) {
    const boss = index % 4 === 3;
    const desired = desiredCourses[index];
    let candidates = pool.filter((item) => item.type === (boss ? 'boss' : item.type) && (boss ? item.type === 'boss' : item.type !== 'boss'));
    candidates = candidates.filter((item) => item.course === desired && !picked.has(item.id));
    if (!candidates.length) {
      candidates = pool.filter((item) => (boss ? item.type === 'boss' : item.type !== 'boss') && !picked.has(item.id));
    }
    if (!candidates.length) throw new Error(`Not enough ${boss ? 'boss' : 'regular'} challenges for a 12-encounter run.`);
    const selected = weightedPick(candidates, mastery, rng);
    picked.add(selected.id);
    result.push(selected);
  }
  return result;
}

function weightedPick(candidates, mastery, rng) {
  const weighted = candidates.map((challenge) => {
    const record = mastery[challenge.topic];
    const value = typeof record?.value === 'number' ? record.value : 0;
    const unseenBoost = record?.attempts ? 0 : 1.6;
    const missedBoost = record?.lastResult === 'wrong' ? 1.8 : 1;
    const weight = Math.max(0.2, (1.25 - value / 100) * unseenBoost * missedBoost);
    return { challenge, weight };
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = rng() * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.challenge;
  }
  return weighted.at(-1).challenge;
}

export function createRun({ course = 'mixed', mode = 'normal', seed, challengeIds }) {
  return {
    version: 1,
    course,
    mode,
    seed: seed >>> 0,
    challengeIds: [...challengeIds],
    cursor: 0,
    score: 0,
    integrity: 3,
    combo: 0,
    bestCombo: 0,
    upgrades: { shield: 0, extraTime: 0, eliminate: 0, comboGuard: 0 },
    results: [],
    status: 'playing',
    startedAt: Date.now(),
  };
}

export function resolveAttempt(run, { challenge, correct, remainingSeconds = 0, timeLimit = 30 }) {
  const next = structuredCloneSafe(run);
  if (next.status !== 'playing') return next;
  const difficulty = clampInteger(challenge.difficulty, 1, 3, 1);
  let protectedHit = false;
  let comboProtected = false;

  if (correct) {
    next.combo += 1;
    next.bestCombo = Math.max(next.bestCombo, next.combo);
    const speedRatio = Math.max(0, Math.min(1, remainingSeconds / Math.max(1, timeLimit)));
    const base = 100 * difficulty * (challenge.type === 'boss' ? 2 : 1);
    const speed = Math.round(100 * speedRatio);
    const multiplier = 1 + Math.min(next.combo - 1, 6) * 0.15;
    next.score += Math.round((base + speed) * multiplier);
  } else {
    if (next.upgrades.shield > 0) {
      next.upgrades.shield -= 1;
      protectedHit = true;
    } else {
      next.integrity = Math.max(0, next.integrity - 1);
    }
    if (next.upgrades.comboGuard > 0) {
      next.upgrades.comboGuard -= 1;
      comboProtected = true;
    } else {
      next.combo = 0;
    }
  }

  next.results.push({
    challengeId: challenge.id,
    course: challenge.course,
    topic: challenge.topic,
    difficulty,
    correct: Boolean(correct),
    protectedHit,
    comboProtected,
  });
  next.cursor += 1;
  if (next.integrity === 0) next.status = 'failed';
  else if (next.cursor >= next.challengeIds.length) next.status = 'complete';
  return next;
}

export function getUpgradeChoices(run, count = 3) {
  const rng = createRng(hashSeed(`${run.seed}:upgrade:${run.cursor}`));
  const options = Object.values(UPGRADES).filter((upgrade) => upgrade.id === 'shield' || run.upgrades[upgrade.id] === 0);
  return [...options].sort(() => rng() - 0.5).slice(0, count);
}

export function applyUpgrade(run, upgradeId) {
  if (!UPGRADES[upgradeId]) throw new Error(`Unknown upgrade: ${upgradeId}`);
  const next = structuredCloneSafe(run);
  next.upgrades[upgradeId] = (next.upgrades[upgradeId] || 0) + 1;
  return next;
}

export function updateSaveAfterRun(saveValue, run, date = new Date()) {
  const save = normalizeSave(saveValue);
  const next = structuredCloneSafe(save);
  next.completedRuns += 1;
  next.personalBests[run.course] = Math.max(next.personalBests[run.course] || 0, run.score);
  for (const result of run.results) {
    const current = next.mastery[result.topic] || { value: 0, attempts: 0, correct: 0, lastResult: null };
    current.attempts += 1;
    if (result.correct) {
      current.correct += 1;
      current.value = Math.min(100, current.value + 5 + result.difficulty * 2);
      current.lastResult = 'correct';
    } else {
      current.value = Math.max(0, current.value - 4);
      current.lastResult = 'wrong';
    }
    next.mastery[result.topic] = current;
  }
  if (run.mode === 'daily') {
    const key = `${localDateKey(date)}:${run.course}`;
    const previous = next.dailyHistory[key];
    next.dailyHistory[key] = {
      score: Math.max(previous?.score || 0, run.score),
      completed: run.status === 'complete' || previous?.completed === true,
    };
  }
  return next;
}

export function summarizeRun(run) {
  const attempted = run.results.length;
  const correct = run.results.filter((result) => result.correct).length;
  const byTopic = {};
  for (const result of run.results) {
    const entry = byTopic[result.topic] || { topic: result.topic, attempted: 0, correct: 0, course: result.course };
    entry.attempted += 1;
    if (result.correct) entry.correct += 1;
    byTopic[result.topic] = entry;
  }
  return {
    attempted,
    correct,
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
    score: run.score,
    bestCombo: run.bestCombo,
    topics: Object.values(byTopic).sort((a, b) => a.correct / a.attempted - b.correct / b.attempted),
  };
}

export function isValidChallenge(challenge) {
  if (!challenge || typeof challenge !== 'object') return false;
  if (!challenge.id || !['comp1521', 'comp1531'].includes(challenge.course)) return false;
  if (!challenge.topic || !challenge.prompt || !challenge.explanation || !challenge.source) return false;
  if (!Number.isInteger(challenge.difficulty) || challenge.difficulty < 1 || challenge.difficulty > 3) return false;
  if (challenge.type === 'boss') {
    return Array.isArray(challenge.steps) && challenge.steps.length === 3 && challenge.steps.every(isValidStep);
  }
  if (['choice', 'trace', 'diagnose'].includes(challenge.type)) {
    return Array.isArray(challenge.choices) && challenge.choices.length >= 2 && Number.isInteger(challenge.answer) && challenge.answer >= 0 && challenge.answer < challenge.choices.length;
  }
  if (challenge.type === 'order') {
    return Array.isArray(challenge.choices) && Array.isArray(challenge.answer) && challenge.answer.length === challenge.choices.length;
  }
  if (challenge.type === 'input') {
    return typeof challenge.answer === 'string' || Array.isArray(challenge.answer);
  }
  return false;
}

function isValidStep(step) {
  if (!step?.prompt || !['choice', 'input'].includes(step.type)) return false;
  if (step.type === 'choice') return Array.isArray(step.choices) && Number.isInteger(step.answer) && step.answer >= 0 && step.answer < step.choices.length;
  return typeof step.answer === 'string' || Array.isArray(step.answer);
}

function otherCourse(course) {
  return course === 'comp1521' ? 'comp1531' : 'comp1521';
}

function clampInteger(value, min, max, fallback) {
  return Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function clampNumber(value, min, max, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function structuredCloneSafe(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}
