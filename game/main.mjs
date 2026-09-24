import {
  ACTIVE_KEY,
  SAVE_KEY,
  applyUpgrade,
  createDefaultSave,
  createRun,
  dailySeed,
  getUpgradeChoices,
  hashSeed,
  localDateKey,
  normalizeSave,
  resolveAttempt,
  selectRunChallenges,
  summarizeRun,
  updateSaveAfterRun,
} from './engine.mjs';
import { TOPICS, createChallengePool } from './content.mjs';

const root = document.getElementById('stackraid-root');
if (!root) throw new Error('StackRaid root was not found.');

let save = loadJson(SAVE_KEY, createDefaultSave(), normalizeSave);
let run = loadJson(ACTIVE_KEY, null, validateActiveRun);
let selectedCourse = 'mixed';
let selectedMode = 'normal';
let pool = run ? createChallengePool(run.seed) : [];
let encounter = freshEncounterState();
let timerHandle = null;
let deadline = 0;
let timeLimit = 0;
let screen = run?.status === 'playing' ? 'play' : 'start';
let audioContext = null;

if (run && !run.challengeIds.every((id) => pool.some((item) => item.id === id))) {
  run = null;
  removeStored(ACTIVE_KEY);
  screen = 'start';
}

root.addEventListener('click', handleClick);
root.addEventListener('submit', handleSubmit);
root.addEventListener('keydown', handleKeydown);
window.addEventListener('hashchange', handleRouteChange);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopTimer();
  else if (isGameRoute() && screen === 'play' && !encounter.feedback) startTimer(false);
});

handleRouteChange();

function handleRouteChange() {
  if (!isGameRoute()) {
    stopTimer();
    return;
  }
  if (run?.status === 'playing') {
    screen = 'play';
    encounter = freshEncounterState();
    render();
    startTimer(true);
  } else {
    screen = run && run.status !== 'playing' ? 'summary' : 'start';
    render();
  }
}

function isGameRoute() {
  return window.location.hash === '#/game';
}

function render() {
  stopTimer();
  if (screen === 'start') renderStart();
  else if (screen === 'play') renderPlay();
  else if (screen === 'upgrade') renderUpgrade();
  else renderSummary();
}

function renderStart() {
  const continueCard = run?.status === 'playing' ? `
    <div class="sr-continue">
      <div><span class="sr-kicker">Run in progress</span><strong>${courseLabel(run.course)} · encounter ${run.cursor + 1}/12</strong></div>
      <button class="sr-button sr-button--primary" data-action="continue-run">Resume run</button>
    </div>` : '';
  const masteryCards = Object.entries(TOPICS).map(([id, topic]) => {
    const record = save.mastery[id] || { value: 0, attempts: 0 };
    return `<div class="sr-mastery-card">
      <div class="sr-mastery-head"><span>${escapeHtml(topic.label)}</span><b>${Math.round(record.value)}%</b></div>
      <div class="sr-meter" aria-label="${escapeHtml(topic.label)} mastery ${Math.round(record.value)} percent"><span style="width:${record.value}%"></span></div>
      <small>${record.attempts ? `${record.attempts} encounter${record.attempts === 1 ? '' : 's'}` : 'Uncharted'}</small>
    </div>`;
  }).join('');
  const dailyKey = `${localDateKey()}:${selectedCourse}`;
  const daily = save.dailyHistory[dailyKey];

  root.innerHTML = `
    <div class="sr-shell sr-shell--start">
      <div class="sr-scanlines" aria-hidden="true"></div>
      <header class="sr-titlebar">
        <div>
          <span class="sr-kicker">cs.notes // exam simulator</span>
          <h1>STACK<span>RAID</span></h1>
          <p>Build a streak. Patch your weak spots. Survive the stack.</p>
        </div>
        ${soundButton()}
      </header>
      ${continueCard}
      <main class="sr-start-grid">
        <section class="sr-panel sr-launch-panel" aria-labelledby="sr-launch-title">
          <div class="sr-panel-number">01</div>
          <h2 id="sr-launch-title">Choose your route</h2>
          <div class="sr-segmented" role="group" aria-label="Course selection">
            ${courseButton('mixed', 'Mixed stack', 'Both courses')}
            ${courseButton('comp1521', 'COMP1521', 'Systems')}
            ${courseButton('comp1531', 'COMP1531', 'Software')}
          </div>
          <div class="sr-mode-grid">
            <button class="sr-mode ${selectedMode === 'normal' ? 'is-active' : ''}" data-action="select-mode" data-value="normal">
              <span class="sr-mode-icon" aria-hidden="true">∞</span>
              <strong>Random run</strong><small>Fresh route every time</small>
            </button>
            <button class="sr-mode ${selectedMode === 'daily' ? 'is-active' : ''}" data-action="select-mode" data-value="daily">
              <span class="sr-mode-icon" aria-hidden="true">24</span>
              <strong>Daily breach</strong><small>${daily ? `Best today: ${formatScore(daily.score)}` : 'One shared seed per day'}</small>
            </button>
          </div>
          <button class="sr-button sr-button--launch" data-action="start-run">
            <span>Start ${selectedMode === 'daily' ? 'daily breach' : '12-encounter run'}</span><span aria-hidden="true">→</span>
          </button>
          <p class="sr-launch-note">Three integrity points · bosses at 04, 08 and 12 · progress saves on this device</p>
        </section>
        <aside class="sr-panel sr-record-panel">
          <div class="sr-panel-number">PB</div>
          <h2>Operator record</h2>
          <div class="sr-record-score"><span>best mixed run</span><strong>${formatScore(save.personalBests.mixed)}</strong></div>
          <div class="sr-record-row"><span>COMP1521</span><b>${formatScore(save.personalBests.comp1521)}</b></div>
          <div class="sr-record-row"><span>COMP1531</span><b>${formatScore(save.personalBests.comp1531)}</b></div>
          <div class="sr-record-row"><span>completed runs</span><b>${save.completedRuns}</b></div>
          <button class="sr-text-button" data-action="reset-progress">Reset saved progress</button>
        </aside>
      </main>
      <section class="sr-mastery" aria-labelledby="sr-mastery-title">
        <div class="sr-section-heading"><span class="sr-kicker">Adaptive targeting</span><h2 id="sr-mastery-title">Topic mastery</h2></div>
        <div class="sr-mastery-grid">${masteryCards}</div>
      </section>
      <div class="sr-live" aria-live="polite"></div>
    </div>`;
}

function renderPlay() {
  const challenge = encounter.feedback
    ? pool.find((item) => item.id === encounter.feedback.challengeId)
    : currentChallenge();
  if (!challenge) {
    finishRun();
    return;
  }
  const result = run.results.at(-1);
  root.innerHTML = `
    <div class="sr-shell sr-shell--play">
      <div class="sr-scanlines" aria-hidden="true"></div>
      <header class="sr-hud">
        <a class="sr-mini-brand" href="#/game" aria-label="StackRaid start">STACK<span>RAID</span></a>
        <div class="sr-hud-stat"><span>integrity</span><strong class="sr-hearts">${renderIntegrity(run.integrity)}</strong></div>
        <div class="sr-hud-stat"><span>score</span><strong>${formatScore(run.score)}</strong></div>
        <div class="sr-hud-stat"><span>combo</span><strong class="${run.combo > 1 ? 'sr-hot' : ''}">×${run.combo}</strong></div>
        ${soundButton()}
      </header>
      ${renderRouteMap()}
      <main class="sr-arena">
        <section class="sr-encounter ${challenge.type === 'boss' ? 'sr-encounter--boss' : ''}" aria-labelledby="sr-question">
          <div class="sr-encounter-top">
            <div>
              <span class="sr-kicker">${challenge.type === 'boss' ? `Sector ${Math.ceil((run.cursor + (encounter.feedback ? 0 : 1)) / 4)} boss` : `${courseLabel(challenge.course)} // ${topicLabel(challenge.topic)}`}</span>
              <span class="sr-difficulty" aria-label="Difficulty ${challenge.difficulty} of 3">${'◆'.repeat(challenge.difficulty)}${'◇'.repeat(3 - challenge.difficulty)}</span>
            </div>
            <div class="sr-timer" aria-label="Time remaining">
              <span id="sr-time-text">--</span>
              <div class="sr-timer-track"><span id="sr-time-bar"></span></div>
            </div>
          </div>
          ${encounter.feedback ? renderFeedback(challenge, result) : renderChallenge(challenge)}
        </section>
        <aside class="sr-run-side">
          <div class="sr-side-block"><span class="sr-kicker">Loadout</span>${renderLoadout()}</div>
          <div class="sr-side-block sr-side-tip"><span class="sr-kicker">Controls</span><p>${controlHint(challenge)}</p></div>
          <button class="sr-text-button" data-action="abandon-run">Abandon run</button>
        </aside>
      </main>
      <div class="sr-live" aria-live="assertive">${encounter.announcement || ''}</div>
    </div>`;
  if (!encounter.feedback) {
    requestAnimationFrame(updateTimerDisplay);
    const field = root.querySelector('.sr-answer-input');
    if (field) field.focus();
  }
}

function renderChallenge(challenge) {
  if (challenge.type === 'boss') return renderBoss(challenge);
  const title = `<h2 id="sr-question">${formatRich(challenge.prompt)}</h2>`;
  if (['choice', 'trace', 'diagnose'].includes(challenge.type)) {
    const eliminated = eliminatedChoice(challenge);
    return `${title}<div class="sr-type-label">${typeLabel(challenge.type)}</div><div class="sr-options">
      ${challenge.choices.map((option, index) => index === eliminated ? '' : `
        <button class="sr-option" data-action="answer-choice" data-index="${index}">
          <span>${index + 1}</span><b>${formatRich(option)}</b>
        </button>`).join('')}
    </div>`;
  }
  if (challenge.type === 'input') {
    return `${title}<div class="sr-type-label">Workbench input</div>
      <form class="sr-input-form" data-form="answer-input">
        <label for="sr-answer">Answer</label>
        <div><input class="sr-answer-input" id="sr-answer" name="answer" autocomplete="off" placeholder="${escapeHtml(challenge.placeholder || 'Type your answer')}" required>
        <button class="sr-button sr-button--primary" type="submit">Lock answer</button></div>
      </form>`;
  }
  const remaining = challenge.choices.filter((option) => !encounter.order.includes(option));
  return `${title}<div class="sr-type-label">Sequence builder</div>
    <div class="sr-order-selected" aria-label="Current sequence">
      ${encounter.order.length ? encounter.order.map((option, index) => `<button data-action="remove-order" data-index="${index}"><span>${index + 1}</span>${formatRich(option)}</button>`).join('') : '<p>Choose the first step below.</p>'}
    </div>
    <div class="sr-order-pool">${remaining.map((option) => `<button data-action="add-order" data-value="${escapeAttr(option)}">${formatRich(option)}</button>`).join('')}</div>
    <button class="sr-button sr-button--primary" data-action="submit-order" ${encounter.order.length !== challenge.answer.length ? 'disabled' : ''}>Lock sequence</button>`;
}

function renderBoss(challenge) {
  const step = challenge.steps[encounter.boss.step];
  const status = challenge.steps.map((_, index) => `<span class="${index < encounter.boss.step ? 'is-done' : index === encounter.boss.step ? 'is-current' : ''}">${index + 1}</span>`).join('');
  const header = `<div class="sr-boss-head"><div class="sr-boss-mark" aria-hidden="true">BOSS</div><div><div class="sr-boss-steps" aria-label="Boss step ${encounter.boss.step + 1} of 3">${status}</div><h2 id="sr-question">${formatRich(challenge.prompt)}</h2></div></div>
    <div class="sr-boss-prompt"><span>STEP ${encounter.boss.step + 1}/3</span><h3>${formatRich(step.prompt)}</h3></div>`;
  if (step.type === 'choice') {
    return `${header}<div class="sr-options">${step.choices.map((option, index) => `<button class="sr-option" data-action="answer-boss-choice" data-index="${index}"><span>${index + 1}</span><b>${formatRich(option)}</b></button>`).join('')}</div>`;
  }
  return `${header}<form class="sr-input-form" data-form="boss-input"><label for="sr-answer">Answer</label><div><input class="sr-answer-input" id="sr-answer" name="answer" autocomplete="off" required><button class="sr-button sr-button--primary" type="submit">Lock step</button></div></form>`;
}

function renderFeedback(challenge, result) {
  const correct = encounter.feedback.correct;
  const protectedText = result?.protectedHit ? ' Mutex Shield absorbed the integrity hit.' : result?.comboProtected ? ' Green Pipeline preserved your combo.' : '';
  return `<div class="sr-feedback ${correct ? 'is-correct' : 'is-wrong'}">
    <div class="sr-feedback-verdict"><span aria-hidden="true">${correct ? '✓' : '×'}</span><div><small>${correct ? 'System stable' : 'Fault detected'}</small><h2 id="sr-question">${correct ? 'Correct' : encounter.feedback.timedOut ? 'Time expired' : 'Not quite'}</h2></div></div>
    <p>${formatRich(challenge.explanation)}${escapeHtml(protectedText)}</p>
    <div class="sr-feedback-actions">
      <a class="sr-source" href="#/${challenge.source}">Open source note <span aria-hidden="true">↗</span></a>
      <button class="sr-button sr-button--primary" data-action="continue-after-answer">${run.status === 'playing' ? (run.cursor === 4 || run.cursor === 8 ? 'Claim upgrade' : 'Next encounter') : 'View run report'} <span aria-hidden="true">→</span></button>
    </div>
  </div>`;
}

function renderUpgrade() {
  const choices = getUpgradeChoices(run);
  root.innerHTML = `<div class="sr-shell sr-shell--upgrade">
    <div class="sr-scanlines" aria-hidden="true"></div>
    <div class="sr-upgrade-wrap">
      <span class="sr-kicker">Sector ${run.cursor / 4} cleared</span>
      <h1>Choose one patch.</h1>
      <p>Your build can carry one more advantage into the next sector.</p>
      <div class="sr-upgrade-grid">${choices.map((upgrade, index) => `<button class="sr-upgrade" data-action="choose-upgrade" data-value="${upgrade.id}">
        <span class="sr-upgrade-key">${index + 1}</span><span class="sr-upgrade-glyph" aria-hidden="true">${upgradeGlyph(upgrade.id)}</span><strong>${upgrade.name}</strong><small>${upgrade.description}</small>
      </button>`).join('')}</div>
    </div>
    <div class="sr-live" aria-live="polite"></div>
  </div>`;
}

function renderSummary() {
  if (!run) {
    screen = 'start';
    renderStart();
    return;
  }
  finalizeRunOnce();
  const summary = summarizeRun(run);
  const won = run.status === 'complete';
  const topicRows = summary.topics.map((topic) => {
    const meta = TOPICS[topic.topic];
    const percent = Math.round((topic.correct / topic.attempted) * 100);
    return `<div class="sr-summary-topic"><div><strong>${escapeHtml(meta?.label || topic.topic)}</strong><small>${topic.correct}/${topic.attempted} correct</small></div><span>${percent}%</span><a href="#/${meta?.source || 'home'}">Review</a></div>`;
  }).join('');
  root.innerHTML = `<div class="sr-shell sr-shell--summary">
    <div class="sr-scanlines" aria-hidden="true"></div>
    <main class="sr-summary-wrap">
      <span class="sr-kicker">Run report // ${courseLabel(run.course)}</span>
      <h1>${won ? 'STACK CLEARED.' : 'BUILD FAILED.'}</h1>
      <p>${won ? 'All three sectors survived. The weak links are now mapped.' : 'The run ended, but every fault updated your mastery map.'}</p>
      <div class="sr-summary-stats">
        <div><span>score</span><strong>${formatScore(summary.score)}</strong></div>
        <div><span>accuracy</span><strong>${summary.accuracy}%</strong></div>
        <div><span>best combo</span><strong>×${summary.bestCombo}</strong></div>
        <div><span>cleared</span><strong>${summary.attempted}/12</strong></div>
      </div>
      <section class="sr-summary-topics"><div class="sr-section-heading"><span class="sr-kicker">Debrief</span><h2>Topic breakdown</h2></div>${topicRows || '<p>No encounters completed.</p>'}</section>
      <div class="sr-summary-actions"><button class="sr-button sr-button--launch" data-action="new-run">Run it back <span aria-hidden="true">↻</span></button><a class="sr-button sr-button--ghost" href="#/home">Return to notes</a></div>
    </main>
    <div class="sr-live" aria-live="polite"></div>
  </div>`;
}

function renderRouteMap() {
  return `<nav class="sr-route-map" aria-label="Run progress">${run.challengeIds.map((_, index) => {
    const boss = index % 4 === 3;
    const state = index < run.cursor ? 'is-done' : index === run.cursor ? 'is-current' : '';
    return `<span class="${state} ${boss ? 'is-boss' : ''}" aria-label="Encounter ${index + 1}${boss ? ', boss' : ''}${state ? `, ${state === 'is-done' ? 'complete' : 'current'}` : ''}">${boss ? 'B' : index + 1}</span>`;
  }).join('')}</nav>`;
}

function renderLoadout() {
  const active = Object.entries(run.upgrades).filter(([, count]) => count > 0);
  if (!active.length) return '<p class="sr-empty-loadout">No patches installed yet.</p>';
  return `<ul class="sr-loadout">${active.map(([id, count]) => `<li><span aria-hidden="true">${upgradeGlyph(id)}</span><div><strong>${upgradeName(id)}</strong><small>${count > 1 ? `${count} charges` : 'active'}</small></div></li>`).join('')}</ul>`;
}

function handleClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button || !root.contains(button)) return;
  const action = button.dataset.action;
  if (action === 'select-course') {
    selectedCourse = button.dataset.value;
    renderStart();
  } else if (action === 'select-mode') {
    selectedMode = button.dataset.value;
    renderStart();
  } else if (action === 'start-run') {
    beginRun();
  } else if (action === 'continue-run') {
    screen = 'play';
    encounter = freshEncounterState();
    renderPlay();
    startTimer(true);
  } else if (action === 'answer-choice') {
    answerChoice(Number(button.dataset.index));
  } else if (action === 'answer-boss-choice') {
    answerBoss(Number(button.dataset.index));
  } else if (action === 'add-order') {
    encounter.order.push(button.dataset.value);
    renderPlay();
    startTimer(false);
  } else if (action === 'remove-order') {
    encounter.order.splice(Number(button.dataset.index), 1);
    renderPlay();
    startTimer(false);
  } else if (action === 'submit-order') {
    const challenge = currentChallenge();
    resolveCurrent(arraysEqual(encounter.order, challenge.answer));
  } else if (action === 'continue-after-answer') {
    continueAfterAnswer();
  } else if (action === 'choose-upgrade') {
    run = applyUpgrade(run, button.dataset.value);
    saveActiveRun();
    playSound('upgrade');
    screen = 'play';
    encounter = freshEncounterState();
    renderPlay();
    startTimer(true);
  } else if (action === 'toggle-sound') {
    save.settings.sound = !save.settings.sound;
    storeJson(SAVE_KEY, save);
    if (save.settings.sound) playSound('correct');
    render();
    if (screen === 'play' && !encounter.feedback) startTimer(false);
  } else if (action === 'abandon-run') {
    if (window.confirm('Abandon this run? Your completed encounters will still update mastery.')) {
      run.status = 'failed';
      finishRun();
    }
  } else if (action === 'new-run') {
    run = null;
    removeStored(ACTIVE_KEY);
    screen = 'start';
    renderStart();
  } else if (action === 'reset-progress') {
    if (window.confirm('Reset all StackRaid mastery and personal bests on this device?')) {
      save = createDefaultSave();
      storeJson(SAVE_KEY, save);
      run = null;
      removeStored(ACTIVE_KEY);
      renderStart();
      announce('Saved StackRaid progress reset.');
    }
  }
}

function handleSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form || !root.contains(form)) return;
  event.preventDefault();
  const value = new FormData(form).get('answer');
  const challenge = currentChallenge();
  if (form.dataset.form === 'boss-input') {
    const step = challenge.steps[encounter.boss.step];
    answerBoss(value, step);
  } else {
    resolveCurrent(matchesAnswer(value, challenge.answer));
  }
}

function handleKeydown(event) {
  if (screen === 'upgrade' && ['1', '2', '3'].includes(event.key)) {
    const choice = root.querySelectorAll('[data-action="choose-upgrade"]')[Number(event.key) - 1];
    choice?.click();
    return;
  }
  if (screen !== 'play' || encounter.feedback || event.target.matches('input')) return;
  if (['1', '2', '3', '4'].includes(event.key)) {
    const choices = root.querySelectorAll('.sr-option');
    choices[Number(event.key) - 1]?.click();
  }
}

function beginRun() {
  const seed = selectedMode === 'daily' ? dailySeed(new Date(), selectedCourse) : hashSeed(`${Date.now()}:${Math.random()}:${selectedCourse}`);
  pool = createChallengePool(seed);
  const challenges = selectRunChallenges(pool, {
    course: selectedCourse,
    seed,
    mastery: selectedMode === 'daily' ? {} : save.mastery,
  });
  run = createRun({ course: selectedCourse, mode: selectedMode, seed, challengeIds: challenges.map((item) => item.id) });
  storeJson(ACTIVE_KEY, run);
  screen = 'play';
  encounter = freshEncounterState();
  playSound('start');
  renderPlay();
  startTimer(true);
}

function answerChoice(index) {
  const challenge = currentChallenge();
  resolveCurrent(index === challenge.answer);
}

function answerBoss(value, suppliedStep = null) {
  const challenge = currentChallenge();
  const step = suppliedStep || challenge.steps[encounter.boss.step];
  const correct = step.type === 'choice' ? Number(value) === step.answer : matchesAnswer(value, step.answer);
  encounter.boss.answers.push(correct);
  if (correct) encounter.boss.correct += 1;
  encounter.boss.step += 1;
  playSound(correct ? 'correct' : 'wrong');
  if (encounter.boss.step >= challenge.steps.length) {
    resolveCurrent(encounter.boss.correct >= 2, false);
  } else {
    encounter.announcement = `${correct ? 'Correct' : 'Incorrect'}. Boss step ${encounter.boss.step + 1} of 3.`;
    renderPlay();
    startTimer(false);
  }
}

function resolveCurrent(correct, sound = true, timedOut = false) {
  stopTimer();
  const challenge = currentChallenge();
  const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  run = resolveAttempt(run, { challenge, correct, remainingSeconds: remaining, timeLimit });
  encounter.feedback = { challengeId: challenge.id, correct, timedOut };
  encounter.announcement = correct ? 'Correct answer.' : timedOut ? 'Time expired.' : 'Incorrect answer.';
  saveActiveRun();
  if (sound) playSound(correct ? 'correct' : 'wrong');
  renderPlay();
}

function continueAfterAnswer() {
  if (run.status !== 'playing') {
    finishRun();
    return;
  }
  if (run.cursor === 4 || run.cursor === 8) {
    screen = 'upgrade';
    renderUpgrade();
    return;
  }
  encounter = freshEncounterState();
  renderPlay();
  startTimer(true);
}

function finishRun() {
  stopTimer();
  if (!run) return;
  if (run.status === 'playing') run.status = 'failed';
  screen = 'summary';
  renderSummary();
}

function finalizeRunOnce() {
  if (run.finalized) return;
  save = updateSaveAfterRun(save, run);
  run.finalized = true;
  storeJson(SAVE_KEY, save);
  removeStored(ACTIVE_KEY);
}

function startTimer(reset) {
  stopTimer();
  const challenge = currentChallenge();
  if (!challenge || encounter.feedback || screen !== 'play' || !isGameRoute()) return;
  if (reset || !deadline || deadline <= Date.now()) {
    timeLimit = (challenge.type === 'boss' ? 62 : 28) + (run.upgrades.extraTime || 0) * 8;
    deadline = Date.now() + timeLimit * 1000;
  }
  timerHandle = window.setInterval(() => {
    updateTimerDisplay();
    if (Date.now() >= deadline) handleTimeout();
  }, 200);
  updateTimerDisplay();
}

function stopTimer() {
  if (timerHandle) window.clearInterval(timerHandle);
  timerHandle = null;
}

function updateTimerDisplay() {
  const text = root.querySelector('#sr-time-text');
  const bar = root.querySelector('#sr-time-bar');
  if (!text || !bar || !deadline) return;
  const remaining = Math.max(0, (deadline - Date.now()) / 1000);
  text.textContent = `${Math.ceil(remaining)}s`;
  bar.style.width = `${Math.min(100, (remaining / timeLimit) * 100)}%`;
  bar.classList.toggle('is-low', remaining <= 7);
}

function handleTimeout() {
  if (encounter.feedback) return;
  const challenge = currentChallenge();
  if (challenge.type === 'boss') {
    resolveCurrent(encounter.boss.correct >= 2, true, true);
  } else {
    resolveCurrent(false, true, true);
  }
}

function currentChallenge() {
  if (!run) return null;
  const id = run.challengeIds[run.cursor];
  return pool.find((challenge) => challenge.id === id) || null;
}

function eliminatedChoice(challenge) {
  if (!run.upgrades.eliminate || !Array.isArray(challenge.choices)) return -1;
  const wrong = challenge.choices.map((_, index) => index).filter((index) => index !== challenge.answer);
  return wrong[hashSeed(`${run.seed}:${challenge.id}`) % wrong.length];
}

function freshEncounterState() {
  return { order: [], boss: { step: 0, correct: 0, answers: [] }, feedback: null, announcement: '' };
}

function saveActiveRun() {
  if (run?.status === 'playing') storeJson(ACTIVE_KEY, run);
  else removeStored(ACTIVE_KEY);
}

function matchesAnswer(value, expected) {
  const normalized = normalizeAnswer(value);
  const answers = Array.isArray(expected) ? expected : [expected];
  return answers.some((answer) => normalizeAnswer(answer) === normalized);
}

function normalizeAnswer(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function courseButton(value, title, subtitle) {
  return `<button class="sr-course ${selectedCourse === value ? 'is-active' : ''}" data-action="select-course" data-value="${value}" aria-pressed="${selectedCourse === value}"><strong>${title}</strong><small>${subtitle}</small></button>`;
}

function soundButton() {
  return `<button class="sr-sound" data-action="toggle-sound" aria-pressed="${save.settings.sound}" aria-label="${save.settings.sound ? 'Mute game sounds' : 'Enable game sounds'}"><span aria-hidden="true">${save.settings.sound ? '◖))' : '◖×'}</span></button>`;
}

function renderIntegrity(value) {
  return Array.from({ length: 3 }, (_, index) => `<span class="${index < value ? 'is-full' : ''}" aria-hidden="true">${index < value ? '◆' : '◇'}</span>`).join('') + `<span class="sr-visually-hidden">${value} of 3</span>`;
}

function controlHint(challenge) {
  if (challenge.type === 'order') return 'Select steps in order. Select a placed step to remove it.';
  if (challenge.type === 'input' || challenge.type === 'boss' && challenge.steps[encounter.boss.step]?.type === 'input') return 'Type your answer and press Enter.';
  return 'Press 1–4 or select an answer. The timer keeps moving.';
}

function typeLabel(type) {
  return ({ choice: 'Rapid classification', trace: 'Trace the output', diagnose: 'Debug the fault' })[type] || type;
}

function topicLabel(id) {
  return TOPICS[id]?.label || id;
}

function courseLabel(course) {
  return ({ mixed: 'Mixed stack', comp1521: 'COMP1521', comp1531: 'COMP1531' })[course] || course;
}

function upgradeGlyph(id) {
  return ({ shield: '◈', extraTime: '+8', eliminate: '⌁', comboGuard: '↯' })[id] || '◆';
}

function upgradeName(id) {
  return ({ shield: 'Mutex Shield', extraTime: 'Clock Cycle+', eliminate: 'Breakpoint', comboGuard: 'Green Pipeline' })[id] || id;
}

function formatScore(value) {
  return Number(value || 0).toLocaleString('en-AU');
}

function formatRich(value) {
  return escapeHtml(String(value)).replace(/`([^`]+)`/g, '<code>$1</code>');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function loadJson(key, fallback, normalizer = (value) => value) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? normalizer(JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
}

function storeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The game remains playable when storage is disabled.
  }
}

function removeStored(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage restrictions.
  }
}

function validateActiveRun(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.challengeIds) || value.challengeIds.length !== 12) return null;
  if (!['mixed', 'comp1521', 'comp1531'].includes(value.course)) return null;
  if (!['playing', 'failed', 'complete'].includes(value.status)) return null;
  return value;
}

function announce(message) {
  const live = root.querySelector('.sr-live');
  if (live) live.textContent = message;
}

function playSound(kind) {
  if (!save.settings.sound) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequencies = { start: 220, correct: 520, wrong: 140, upgrade: 700 };
    oscillator.type = kind === 'wrong' ? 'sawtooth' : 'square';
    oscillator.frequency.value = frequencies[kind] || 320;
    gain.gain.setValueAtTime(0.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.12);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
  } catch {
    // Audio is optional and never blocks play.
  }
}
