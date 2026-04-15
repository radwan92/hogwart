import { getKids, updatePoints, esc, avatarFor, renderStarIcons } from '../db.js';
import { flyStars, confetti, playPointSounds } from './home.js';

const CIRCUMFERENCE = 2 * Math.PI * 90;
const STAR_IMG = 'assets/star.png';

let kids = [];
let selectedKids = new Set();
let rewardStars = 3;
let durationMin = 5;
let durationSec = 0;

let phase = 'setup';
let totalMs = 0;
let elapsedMs = 0;
let lastTick = 0;
let interval = null;
let awarded = new Set();
let autoReward = false;
let failureAudio = null;

export function render() {
  return '<div id="reward-view"><div class="spinner-wrap"><div class="spinner"></div></div></div>';
}

export async function init() {
  kids = await getKids();
  if (selectedKids.size === 0) {
    selectedKids = new Set(kids.map(k => k.id));
  }
  phase = 'setup';
  awarded = new Set();
  elapsedMs = 0;

  failureAudio = new Audio('assets/failure.wav');

  renderSetup();
}

function renderSetup() {
  phase = 'setup';
  const el = document.getElementById('reward-view');
  el.innerHTML = `
    <div class="reward-setup">
      <div class="reward-field">
        <label class="reward-label">Time</label>
        <div class="reward-time-inputs">
          <input type="number" id="reward-min" value="${durationMin}" min="0" max="60"> <span>min</span>
          <input type="number" id="reward-sec" value="${durationSec}" min="0" max="59" step="5"> <span>sec</span>
        </div>
      </div>
      <div class="reward-field">
        <label class="reward-label">Reward</label>
        <div class="reward-stars-input">
          <button class="reward-adj" id="reward-minus">&minus;</button>
          <span class="reward-amount" id="reward-amount">${rewardStars}</span>
          <img class="reward-star-icon" src="${STAR_IMG}" alt="">
          <button class="reward-adj" id="reward-plus">+</button>
        </div>
      </div>
      <div class="reward-field">
        <label class="reward-label">Kids</label>
        <div class="reward-kids">
          ${kids.map(kid => `
            <label class="reward-kid-check">
              <input type="checkbox" data-kid="${kid.id}" ${selectedKids.has(kid.id) ? 'checked' : ''}>
              ${avatarFor(kid.name) ? `<img class="kid-avatar-sm" src="${avatarFor(kid.name)}" alt="">` : ''}
              ${esc(kid.name)}
            </label>
          `).join('')}
        </div>
      </div>
      <div class="reward-field">
        <label class="reward-kid-check">
          <input type="checkbox" id="reward-auto" ${autoReward ? 'checked' : ''}>
          Auto-award when time ends
        </label>
      </div>
      <button class="reward-start-btn" id="reward-start">Start</button>
    </div>
  `;

  el.querySelector('#reward-auto').addEventListener('change', (e) => {
    autoReward = e.target.checked;
  });
  el.querySelector('#reward-start').addEventListener('click', startChallenge);
  el.querySelector('#reward-minus').addEventListener('click', () => {
    rewardStars = Math.max(1, rewardStars - 1);
    el.querySelector('#reward-amount').textContent = rewardStars;
  });
  el.querySelector('#reward-plus').addEventListener('click', () => {
    rewardStars = Math.min(99, rewardStars + 1);
    el.querySelector('#reward-amount').textContent = rewardStars;
  });
  el.querySelectorAll('.reward-kid-check input[data-kid]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selectedKids.add(cb.dataset.kid);
      else selectedKids.delete(cb.dataset.kid);
    });
  });
}

function startChallenge() {
  const el = document.getElementById('reward-view');
  durationMin = parseInt(el.querySelector('#reward-min').value) || 0;
  durationSec = parseInt(el.querySelector('#reward-sec').value) || 0;
  totalMs = (durationMin * 60 + durationSec) * 1000;

  if (totalMs <= 0 || selectedKids.size === 0 || rewardStars <= 0) return;

  phase = 'running';
  elapsedMs = 0;
  awarded = new Set();
  lastTick = Date.now();

  renderRunning();
  interval = setInterval(tick, 100);
}

function renderRunning() {
  const el = document.getElementById('reward-view');
  el.innerHTML = `
    <div class="reward-running">
      <div class="gauge-container reward-gauge">
        <svg viewBox="0 0 200 200" class="gauge">
          <circle cx="100" cy="100" r="90" fill="none" stroke="#eee" stroke-width="12"/>
          <circle class="gauge-circle" cx="100" cy="100" r="90" fill="none" stroke="#4CAF50" stroke-width="12"
            stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="0" stroke-linecap="round"
            transform="rotate(-90 100 100)"/>
        </svg>
        <div class="gauge-text">
          <div class="gauge-points reward-countdown">${formatTime(totalMs)}</div>
        </div>
      </div>
      <div class="reward-info">
        <div class="reward-controls">
          <button id="reward-pause" class="reward-pause-btn">Pause</button>
        </div>
        <div class="reward-prize">
          ${renderStarIcons(rewardStars, 'reward-prize-star')}
        </div>
        <div class="reward-awards">
          ${[...selectedKids].map(kidId => {
            const kid = kids.find(k => k.id === kidId);
            return `
              <button class="reward-award-btn" data-kid="${kidId}">
                ${avatarFor(kid.name) ? `<img class="kid-avatar" src="${avatarFor(kid.name)}" alt="">` : ''}
                <span>Award ${esc(kid.name)}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  el.querySelector('#reward-pause').addEventListener('click', togglePause);
  el.querySelectorAll('.reward-award-btn').forEach(btn => {
    btn.addEventListener('click', () => awardKid(btn.dataset.kid));
  });
}

// ---- Timer logic ----

function tick() {
  if (phase !== 'running') return;

  const now = Date.now();
  elapsedMs += now - lastTick;
  lastTick = now;

  const remaining = Math.max(0, totalMs - elapsedMs);
  const fraction = totalMs > 0 ? remaining / totalMs : 0;

  const circle = document.querySelector('#reward-view .gauge-circle');
  if (circle) {
    circle.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
    circle.style.stroke = gaugeColor(fraction);
  }

  const countdown = document.querySelector('.reward-countdown');
  if (countdown) countdown.textContent = formatTime(remaining);

  if (remaining <= 0) {
    phase = 'done';
    clearInterval(interval);
    interval = null;
    onTimeUp();
  }
}

function togglePause() {
  if (phase === 'running') {
    phase = 'paused';
    elapsedMs += Date.now() - lastTick;
    clearInterval(interval);
    interval = null;
  } else if (phase === 'paused') {
    phase = 'running';
    lastTick = Date.now();
    interval = setInterval(tick, 100);
  }

  const btn = document.querySelector('#reward-pause');
  if (btn) btn.textContent = phase === 'paused' ? 'Resume' : 'Pause';
}

// ---- Award ----

async function awardKid(kidId) {
  if (awarded.has(kidId)) return;
  if (phase !== 'running' && phase !== 'paused' && !(phase === 'done' && autoReward)) return;

  awarded.add(kidId);

  const btn = document.querySelector(`.reward-award-btn[data-kid="${kidId}"]`);
  const gaugeEl = document.querySelector('.reward-gauge');

  if (btn && gaugeEl) {
    flyStars(gaugeEl, btn, rewardStars);
    confetti(rewardStars);
    playPointSounds(rewardStars);
  }

  if (btn) {
    btn.classList.add('awarded');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Awarded!';
    btn.classList.add('card-reward');
    setTimeout(() => btn.classList.remove('card-reward'), 600);
  }

  try {
    await updatePoints(kidId, rewardStars, 'reward');
  } catch (e) { /* best effort */ }

  if (awarded.size >= selectedKids.size) {
    phase = 'done';
    clearInterval(interval);
    interval = null;
    onAllAwarded();
  }
}

// ---- End states ----

function onTimeUp() {
  if (autoReward) {
    // Auto-award all unawarded kids
    const unawarded = [...selectedKids].filter(id => !awarded.has(id));
    unawarded.forEach((kidId, i) => {
      setTimeout(() => awardKid(kidId), i * 300);
    });
    return;
  }

  try {
    if (failureAudio) {
      failureAudio.currentTime = 0;
      failureAudio.play();
    }
  } catch (e) { /* audio not available */ }

  const countdown = document.querySelector('.reward-countdown');
  if (countdown) {
    countdown.textContent = "Time's up!";
    countdown.style.color = '#f44336';
    countdown.style.fontSize = 'min(1.2rem, 3.5vh)';
  }

  document.querySelectorAll('.reward-award-btn:not(.awarded)').forEach(btn => {
    btn.disabled = true;
    btn.classList.add('failed');
  });

  showResetButton('Try Again');
}

function onAllAwarded() {
  showResetButton('New Challenge');
}

function showResetButton(label) {
  const controls = document.querySelector('.reward-controls');
  if (!controls) return;
  controls.innerHTML = `<button class="reward-start-btn" id="reward-reset">${label}</button>`;
  controls.querySelector('#reward-reset').addEventListener('click', renderSetup);
}

// ---- Helpers ----

function gaugeColor(f) {
  f = Math.max(0, Math.min(1, f));
  let r, g;
  if (f > 0.5) {
    const t = (1 - f) / 0.5;
    r = Math.round(76 + (255 - 76) * t);
    g = Math.round(175 + (193 - 175) * t);
  } else {
    const t = (0.5 - f) / 0.5;
    r = 255;
    g = Math.round(193 - (193 - 67) * t);
  }
  return `rgb(${r},${g},${f > 0.5 ? 80 : 54})`;
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

export function destroy() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  phase = 'setup';
}
