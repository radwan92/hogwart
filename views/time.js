import { getKids, updatePoints, getSetting } from '../db.js';

const CIRCUMFERENCE = 2 * Math.PI * 90;
const STAR_IMG = 'star.png';

let kids = [];
let pointsPerMinute = 1;
let timers = {};        // keyed by kid id
let displayedStars = {}; // keyed by kid id — current visible star count in orbit

export function render() {
  return '<div id="time-view"><div class="spinner-wrap"><div class="spinner"></div></div></div>';
}

export async function init() {
  const [k, ratio] = await Promise.all([
    getKids(),
    getSetting('time_ratio')
  ]);
  kids = k;
  pointsPerMinute = parseFloat(ratio) || 1;

  const el = document.getElementById('time-view');
  el.innerHTML = `<div class="time-grid">
    ${kids.map(kid => `
      <div class="time-card" data-kid="${kid.id}">
        <h2>${kid.name}</h2>
        <div class="gauge-container">
          <svg viewBox="0 0 200 200" class="gauge">
            <circle cx="100" cy="100" r="90" fill="none" stroke="#eee" stroke-width="12"/>
            <circle class="gauge-circle" cx="100" cy="100" r="90" fill="none" stroke="#4CAF50" stroke-width="12"
              stroke-dasharray="${CIRCUMFERENCE}" stroke-dashoffset="0" stroke-linecap="round"
              transform="rotate(-90 100 100)"/>
          </svg>
          <div class="gauge-text">
            <img class="gauge-star-icon" src="${STAR_IMG}" alt="">
            <div class="gauge-points">${kid.points}</div>
          </div>
          <div class="orbit-stars"></div>
        </div>
        <div class="time-elapsed">00:00</div>
        <div class="time-controls">
          <button class="start-btn">Start</button>
          <button class="stop-btn hidden">Stop</button>
        </div>
      </div>
    `).join('')}
  </div>`;

  kids.forEach(kid => {
    displayedStars[kid.id] = kid.points;
    renderOrbitStars(kid.id, kid.points);
    const card = el.querySelector(`.time-card[data-kid="${kid.id}"]`);
    card.querySelector('.start-btn').addEventListener('click', () => startTimer(kid.id));
    card.querySelector('.stop-btn').addEventListener('click', () => stopTimer(kid.id));
  });
}

// ---- Orbit stars ----

function renderOrbitStars(kidId, count) {
  const card = getCard(kidId);
  const container = card.querySelector('.orbit-stars');
  const existing = container.querySelectorAll('.orbit-star');

  // Remove excess stars (fade out)
  while (existing.length > count) {
    const star = existing[existing.length - 1];
    star.classList.add('orbit-star-out');
    const s = star; // capture for closure
    setTimeout(() => s.remove(), 300);
    // remove from live collection by breaking — we'll rebuild positions below
    break;
  }

  // Rebuild: clear and recreate for simplicity (transitions handle smoothness)
  container.innerHTML = '';
  const radius = 38; // % from center — outside the gauge ring

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2; // start from top
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);

    const img = document.createElement('img');
    img.src = STAR_IMG;
    img.className = 'orbit-star';
    img.style.left = x + '%';
    img.style.top = y + '%';
    container.appendChild(img);
  }
}

function updateOrbitStars(kidId, newCount) {
  const oldCount = displayedStars[kidId];
  if (newCount === oldCount) return;
  displayedStars[kidId] = newCount;

  const card = getCard(kidId);
  const container = card.querySelector('.orbit-stars');
  const stars = Array.from(container.querySelectorAll('.orbit-star:not(.orbit-star-out)'));
  const radius = 38;

  if (newCount < stars.length) {
    // Fade out excess stars from the end
    for (let i = newCount; i < stars.length; i++) {
      stars[i].classList.add('orbit-star-out');
      const s = stars[i];
      setTimeout(() => s.remove(), 300);
    }
    // Reposition remaining stars to spread evenly (CSS transition handles the animation)
    for (let i = 0; i < newCount; i++) {
      const angle = (i / newCount) * Math.PI * 2 - Math.PI / 2;
      stars[i].style.left = (50 + radius * Math.cos(angle)) + '%';
      stars[i].style.top = (50 + radius * Math.sin(angle)) + '%';
    }
  } else if (newCount > stars.length) {
    renderOrbitStars(kidId, newCount);
  }
}

// ---- Timer logic ----

function getCard(kidId) {
  return document.querySelector(`.time-card[data-kid="${kidId}"]`);
}

function startTimer(kidId) {
  const kid = kids.find(k => k.id === kidId);
  if (!kid || kid.points <= 0) return;
  if (timers[kidId]) return;

  const card = getCard(kidId);
  card.querySelector('.start-btn').classList.add('hidden');
  card.querySelector('.stop-btn').classList.remove('hidden');

  timers[kidId] = {
    startTime: Date.now(),
    startPoints: kid.points,
    lastDeducted: 0,
    interval: setInterval(() => tick(kidId), 1000)
  };
}

async function tick(kidId) {
  const state = timers[kidId];
  if (!state) return;

  const kid = kids.find(k => k.id === kidId);
  const card = getCard(kidId);
  const elapsedMin = (Date.now() - state.startTime) / 1000 / 60;
  const pointsConsumed = Math.floor(elapsedMin * pointsPerMinute);
  const remaining = Math.max(0, state.startPoints - pointsConsumed);

  const exactRemaining = Math.max(0, state.startPoints - elapsedMin * pointsPerMinute);
  const fraction = state.startPoints > 0 ? exactRemaining / state.startPoints : 0;

  card.querySelector('.gauge-points').textContent = remaining;
  updateGauge(card, fraction);
  updateOrbitStars(kidId, remaining);

  const totalSec = Math.floor((Date.now() - state.startTime) / 1000);
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  card.querySelector('.time-elapsed').textContent = `${min}:${sec}`;

  if (pointsConsumed > state.lastDeducted) {
    const diff = pointsConsumed - state.lastDeducted;
    state.lastDeducted = pointsConsumed;
    await updatePoints(kid.id, -diff, `time:${min}:${sec}`);
    kid.points = remaining;
  }

  if (remaining <= 0) {
    stopTimer(kidId);
    alarm(card);
  }
}

function updateGauge(card, fraction) {
  const circle = card.querySelector('.gauge-circle');
  circle.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
  circle.style.stroke = gaugeColor(fraction);
}

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

function alarm(card) {
  card.querySelector('.gauge-points').style.color = '#f44336';
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 800;
    osc.type = 'square';
    gain.gain.value = 0.3;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => gain.gain.value = 0, 300);
    setTimeout(() => gain.gain.value = 0.3, 500);
    setTimeout(() => gain.gain.value = 0, 800);
    setTimeout(() => gain.gain.value = 0.3, 1000);
    setTimeout(() => { osc.stop(); ctx.close(); }, 1300);
  } catch (e) { /* audio not available */ }
}

function stopTimer(kidId) {
  const state = timers[kidId];
  if (state) {
    clearInterval(state.interval);
    delete timers[kidId];
  }
  const card = getCard(kidId);
  if (card) {
    card.querySelector('.start-btn').classList.remove('hidden');
    card.querySelector('.stop-btn').classList.add('hidden');
  }
}

export function destroy() {
  Object.keys(timers).forEach(stopTimer);
}
