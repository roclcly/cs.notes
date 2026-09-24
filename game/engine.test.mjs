import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyUpgrade,
  createDefaultSave,
  createRun,
  dailySeed,
  getUpgradeChoices,
  isValidChallenge,
  normalizeSave,
  resolveAttempt,
  selectRunChallenges,
  summarizeRun,
  updateSaveAfterRun,
} from './engine.mjs';
import { AUTHORED_CHALLENGES, createChallengePool } from './content.mjs';

test('ships at least 56 reviewed, uniquely identified challenges', () => {
  assert.ok(AUTHORED_CHALLENGES.length >= 56);
  assert.equal(new Set(AUTHORED_CHALLENGES.map((item) => item.id)).size, AUTHORED_CHALLENGES.length);
  for (const challenge of AUTHORED_CHALLENGES) assert.equal(isValidChallenge(challenge), true, challenge.id);
});

test('every source route exists in the notes router', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const routes = new Set([...html.matchAll(/data-route="([^"]+)"/g)].map((match) => match[1]));
  for (const challenge of AUTHORED_CHALLENGES) assert.ok(routes.has(challenge.source), `${challenge.id}: ${challenge.source}`);
});

test('daily seeds are stable for a date and separated by course', () => {
  assert.equal(dailySeed('2026-09-24', 'mixed'), dailySeed('2026-09-24', 'mixed'));
  assert.notEqual(dailySeed('2026-09-24', 'mixed'), dailySeed('2026-09-24', 'comp1521'));
  assert.notEqual(dailySeed('2026-09-24', 'mixed'), dailySeed('2026-09-25', 'mixed'));
});

test('selection is deterministic, unique, balanced and places bosses correctly', () => {
  const pool = createChallengePool(42);
  const first = selectRunChallenges(pool, { course: 'mixed', seed: 42, mastery: {} });
  const second = selectRunChallenges(pool, { course: 'mixed', seed: 42, mastery: {} });
  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
  assert.equal(new Set(first.map((item) => item.id)).size, 12);
  assert.equal(first.filter((item) => item.course === 'comp1521').length, 6);
  assert.equal(first.filter((item) => item.course === 'comp1531').length, 6);
  assert.deepEqual(first.map((item) => item.type === 'boss'), [false, false, false, true, false, false, false, true, false, false, false, true]);
});

test('course-specific runs stay in their course', () => {
  const pool = createChallengePool(9);
  for (const course of ['comp1521', 'comp1531']) {
    const run = selectRunChallenges(pool, { course, seed: 9, mastery: {} });
    assert.ok(run.every((item) => item.course === course));
  }
});

test('correct answers score with combo and speed bonuses', () => {
  const challenge = { id: 'x', course: 'comp1521', topic: '1521-mips', difficulty: 2, type: 'choice' };
  const initial = createRun({ challengeIds: Array(12).fill('x'), seed: 1 });
  const one = resolveAttempt(initial, { challenge, correct: true, remainingSeconds: 20, timeLimit: 30 });
  const two = resolveAttempt(one, { challenge, correct: true, remainingSeconds: 20, timeLimit: 30 });
  assert.equal(one.combo, 1);
  assert.equal(two.combo, 2);
  assert.ok(two.score > one.score * 2);
});

test('shield and combo guard absorb exactly one consequence', () => {
  const challenge = { id: 'x', course: 'comp1521', topic: '1521-mips', difficulty: 1, type: 'choice' };
  let run = createRun({ challengeIds: Array(12).fill('x'), seed: 1 });
  run.combo = 3;
  run = applyUpgrade(applyUpgrade(run, 'shield'), 'comboGuard');
  const result = resolveAttempt(run, { challenge, correct: false });
  assert.equal(result.integrity, 3);
  assert.equal(result.combo, 3);
  assert.equal(result.upgrades.shield, 0);
  assert.equal(result.upgrades.comboGuard, 0);
  assert.equal(result.results[0].protectedHit, true);
});

test('upgrade choices are deterministic and valid', () => {
  const run = createRun({ challengeIds: Array(12).fill('x'), seed: 765 });
  const first = getUpgradeChoices(run).map((item) => item.id);
  const second = getUpgradeChoices(run).map((item) => item.id);
  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.equal(new Set(first).size, 3);
});

test('save normalization rejects malformed values without losing valid preferences', () => {
  const save = normalizeSave({
    version: 1,
    completedRuns: -4,
    personalBests: { mixed: 800 },
    settings: { sound: true },
    mastery: { topic: { value: 140, attempts: 2, correct: 1, lastResult: 'wrong' } },
  });
  assert.equal(save.completedRuns, 0);
  assert.equal(save.personalBests.mixed, 800);
  assert.equal(save.settings.sound, true);
  assert.equal(save.mastery.topic.value, 100);
});

test('finishing a run updates personal bests, mastery and daily history', () => {
  const challenge = { id: 'x', course: 'comp1531', topic: '1531-web', difficulty: 3, type: 'boss' };
  let run = createRun({ course: 'comp1531', mode: 'daily', challengeIds: ['x'], seed: 7 });
  run = resolveAttempt(run, { challenge, correct: true, remainingSeconds: 10, timeLimit: 20 });
  const save = updateSaveAfterRun(createDefaultSave(), run, new Date(2026, 8, 24));
  assert.equal(save.completedRuns, 1);
  assert.equal(save.personalBests.comp1531, run.score);
  assert.equal(save.mastery['1531-web'].attempts, 1);
  assert.equal(save.mastery['1531-web'].lastResult, 'correct');
  assert.equal(save.dailyHistory['2026-09-24:comp1531'].completed, true);
  assert.equal(summarizeRun(run).accuracy, 100);
});
