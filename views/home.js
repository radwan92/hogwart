import { getKids, updatePoints } from '../db.js';

let kids = [];
let selectedKid = null;
let selectedDelta = null;
let animating = false;

const STAR_IMG = 'star.png';

function renderStarsHTML(count) {
  if (count <= 0) return '<div class="star-grid"><span class="empty-stars">No stars yet</span></div>';
  const stars = Array(count).fill(`<img class="star" src="${STAR_IMG}" alt="">`).join('');
  return `<div class="star-grid">${stars}</div>`;
}

function animateStars(kidId, oldCount, newCount) {
  const container = document.querySelector(`.home-kid-stars[data-id="${kidId}"]`);
  let grid = container.querySelector('.star-grid');

  // First render — just set it
  if (!grid) {
    container.innerHTML = renderStarsHTML(newCount);
    return;
  }

  const emptyMsg = grid.querySelector('.empty-stars');
  if (emptyMsg) emptyMsg.remove();

  const diff = newCount - oldCount;

  if (diff > 0) {
    // Add stars one at a time with staggered fade-in
    for (let i = 0; i < diff; i++) {
      const img = document.createElement('img');
      img.className = 'star star-enter';
      img.src = STAR_IMG;
      img.alt = '';
      grid.appendChild(img);
      // Stagger: trigger fade-in after a delay
      setTimeout(() => img.classList.remove('star-enter'), 40 + i * 80);
    }
  } else if (diff < 0) {
    // Remove stars one at a time from the end with staggered fade-out
    const stars = grid.querySelectorAll('.star');
    const removeCount = Math.min(-diff, stars.length);
    for (let i = 0; i < removeCount; i++) {
      const idx = stars.length - 1 - i;
      const star = stars[idx];
      setTimeout(() => {
        star.classList.add('star-exit');
        star.addEventListener('transitionend', () => star.remove(), { once: true });
        // Fallback removal
        setTimeout(() => { if (star.parentNode) star.remove(); }, 350);
      }, i * 80);
    }
  }

  // Handle zero state
  if (newCount <= 0) {
    setTimeout(() => {
      if (grid.querySelectorAll('.star:not(.star-exit)').length === 0) {
        grid.innerHTML = '<span class="empty-stars">No stars yet</span>';
      }
    }, Math.abs(diff) * 80 + 350);
  }
}

export function render() {
  return '<div id="home-view"><div class="spinner-wrap"><div class="spinner"></div></div></div>';
}

export async function init() {
  kids = await getKids();
  selectedKid = null;
  selectedDelta = null;
  animating = false;

  const el = document.getElementById('home-view');
  el.innerHTML = `
    <div class="home-kids">
      ${kids.map(kid => `
        <button class="home-kid-card" data-id="${kid.id}">
          <div class="home-kid-name">${kid.name}</div>
          <div class="home-kid-stars" data-id="${kid.id}">${renderStarsHTML(kid.points)}</div>
          <div class="home-kid-number" data-id="${kid.id}">${kid.points}</div>
        </button>
      `).join('')}
    </div>
    <div class="home-buttons">
      <div class="add-buttons">
        ${[1, 2, 5, 10].map(n =>
          `<button class="btn-add home-delta" data-delta="${n}">+${n}</button>`
        ).join('')}
      </div>
      <div class="sub-buttons">
        ${[1, 2, 5, 10].map(n =>
          `<button class="btn-sub home-delta" data-delta="-${n}">&minus;${n}</button>`
        ).join('')}
      </div>
    </div>
  `;

  el.querySelectorAll('.home-kid-card').forEach(card => {
    card.addEventListener('click', () => onKidClick(card.dataset.id));
  });

  el.querySelectorAll('.home-delta').forEach(btn => {
    btn.addEventListener('click', () => onDeltaClick(parseInt(btn.dataset.delta)));
  });
}

function onKidClick(kidId) {
  if (animating) return;
  if (selectedDelta !== null) {
    award(kidId, selectedDelta);
    clearSelection();
  } else {
    selectedKid = selectedKid === kidId ? null : kidId;
    updateHighlights();
  }
}

function onDeltaClick(delta) {
  if (animating) return;
  if (selectedKid !== null) {
    award(selectedKid, delta);
    clearSelection();
  } else {
    selectedDelta = selectedDelta === delta ? null : delta;
    updateHighlights();
  }
}

async function award(kidId, delta) {
  animating = true;
  const kid = kids.find(k => k.id === kidId);
  const cardEl = document.querySelector(`.home-kid-card[data-id="${kidId}"]`);
  const btnEl = document.querySelector(`.home-delta[data-delta="${delta}"]`);
  const absDelta = Math.abs(delta);

  // Fire effects and DB update all at once — don't wait
  if (delta > 0) {
    flyStars(btnEl, cardEl, absDelta);
    confetti(absDelta);
  } else {
    fallingStars(cardEl, absDelta);
  }

  // Optimistic UI update
  const oldPoints = kid.points;
  const optimisticPoints = Math.max(0, kid.points + delta);
  kid.points = optimisticPoints;
  animateStars(kidId, oldPoints, optimisticPoints);
  document.querySelector(`.home-kid-number[data-id="${kidId}"]`).textContent = optimisticPoints;

  // Card shake/glow immediately
  const cls = delta > 0 ? 'card-reward' : 'card-penalty';
  cardEl.classList.remove('card-reward', 'card-penalty');
  void cardEl.offsetWidth;
  cardEl.classList.add(cls);
  setTimeout(() => cardEl.classList.remove(cls), 600);

  // DB update — reconcile if server disagrees
  const newPoints = await updatePoints(kidId, delta, 'manual');
  if (newPoints !== optimisticPoints) {
    animateStars(kidId, optimisticPoints, newPoints);
    kid.points = newPoints;
    document.querySelector(`.home-kid-number[data-id="${kidId}"]`).textContent = newPoints;
  }

  animating = false;
}

function flyStars(fromEl, toEl, count) {
  return new Promise(resolve => {
    const fromRect = fromEl.getBoundingClientRect();
    const toRect = toEl.getBoundingClientRect();

    const fromX = fromRect.left + fromRect.width / 2;
    const fromY = fromRect.top + fromRect.height / 2;
    const toX = toRect.left + toRect.width / 2;
    const toY = toRect.top + toRect.height / 2;

    const dx = toX - fromX;
    const dy = toY - fromY;

    let completed = 0;

    for (let i = 0; i < count; i++) {
      const star = document.createElement('img');
      star.src = STAR_IMG;
      star.className = 'flying-star';
      star.style.left = fromX + 'px';
      star.style.top = fromY + 'px';
      document.body.appendChild(star);

      // Random spread at start
      const ox = (Math.random() - 0.5) * 24;
      const oy = (Math.random() - 0.5) * 24;
      // Arc midpoint (lift upward)
      const mx = dx * 0.5 + (Math.random() - 0.5) * 40;
      const my = dy * 0.5 - Math.abs(dy) * 0.3 - 30 + (Math.random() - 0.5) * 20;

      const anim = star.animate([
        {
          transform: `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) scale(0.3)`,
          opacity: 0.8
        },
        {
          transform: `translate(calc(-50% + ${mx}px), calc(-50% + ${my}px)) scale(1.1)`,
          opacity: 1,
          offset: 0.5
        },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.6)`,
          opacity: 0.9
        }
      ], {
        duration: 420 + Math.random() * 160,
        delay: i * 50,
        easing: 'cubic-bezier(0.2, 0, 0.2, 1)',
        fill: 'forwards'
      });

      anim.onfinish = () => {
        star.remove();
        completed++;
        if (completed === count) resolve();
      };
    }

    // Fallback in case something goes wrong
    if (count === 0) resolve();
  });
}

function clearSelection() {
  selectedKid = null;
  selectedDelta = null;
  updateHighlights();
}

function updateHighlights() {
  document.querySelectorAll('.home-kid-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.id === selectedKid);
  });
  document.querySelectorAll('.home-delta').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.delta) === selectedDelta);
  });
}

// ---- Confetti ----

const CONFETTI_COLORS = ['#f44336','#e91e63','#9c27b0','#3f51b5','#2196f3','#00bcd4','#4CAF50','#ffeb3b','#ff9800','#ff5722'];

function confetti(points) {
  const count = Math.min(points * 12, 120);
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const w = 6 + Math.random() * 6;
    const h = w * (0.4 + Math.random() * 0.8);
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.background = color;
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';

    // Start position: bottom center with wide horizontal spread
    const startX = vw * 0.2 + Math.random() * vw * 0.6;
    el.style.left = startX + 'px';
    el.style.top = vh + 'px';
    document.body.appendChild(el);

    // Physics-based: burst up with deceleration, hang at peak, gentle fall
    const peakY = -(vh * (0.4 + Math.random() * 0.5));
    const driftX = (Math.random() - 0.5) * vw * 0.8;
    const endY = 60 + Math.random() * 60;
    const spin = (Math.random() - 0.5) * 720;
    const wobble = (Math.random() - 0.5) * 80;
    const duration = 3000 + Math.random() * 1500;

    const anim = el.animate([
      {
        transform: `translate(0, 0) rotate(0deg)`,
        opacity: 1,
        offset: 0
      },
      {
        transform: `translate(${driftX * 0.15}px, ${peakY * 0.7}px) rotate(${spin * 0.15}deg)`,
        opacity: 1,
        offset: 0.1
      },
      {
        transform: `translate(${driftX * 0.25}px, ${peakY * 0.92}px) rotate(${spin * 0.25}deg)`,
        opacity: 1,
        offset: 0.18
      },
      {
        transform: `translate(${driftX * 0.32}px, ${peakY * 0.99}px) rotate(${spin * 0.3}deg)`,
        opacity: 1,
        offset: 0.25
      },
      {
        transform: `translate(${driftX * 0.38}px, ${peakY}px) rotate(${spin * 0.35}deg)`,
        opacity: 1,
        offset: 0.32
      },
      {
        transform: `translate(${driftX * 0.45 + wobble}px, ${peakY * 0.95}px) rotate(${spin * 0.45}deg)`,
        opacity: 1,
        offset: 0.42
      },
      {
        transform: `translate(${driftX * 0.6 - wobble}px, ${peakY * 0.7}px) rotate(${spin * 0.6}deg)`,
        opacity: 1,
        offset: 0.55
      },
      {
        transform: `translate(${driftX * 0.75 + wobble * 0.5}px, ${peakY * 0.3}px) rotate(${spin * 0.75}deg)`,
        opacity: 0.85,
        offset: 0.7
      },
      {
        transform: `translate(${driftX * 0.9 - wobble * 0.5}px, ${peakY * -0.1}px) rotate(${spin * 0.9}deg)`,
        opacity: 0.5,
        offset: 0.85
      },
      {
        transform: `translate(${driftX + wobble}px, ${endY}px) rotate(${spin}deg)`,
        opacity: 0,
        offset: 1
      }
    ], {
      duration,
      delay: Math.random() * 250,
      easing: 'linear',
      fill: 'forwards'
    });

    anim.onfinish = () => el.remove();
  }
}

// ---- Falling stars + screen shake ----

function fallingStars(cardEl, count) {
  // Screen shake
  document.body.classList.add('screen-shake');
  setTimeout(() => document.body.classList.remove('screen-shake'), 500);

  // Spawn falling stars from the card area
  const rect = cardEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const vh = window.innerHeight;
  const numStars = count;

  for (let i = 0; i < numStars; i++) {
    const star = document.createElement('img');
    star.src = STAR_IMG;
    star.className = 'falling-star';

    // Start spread around the card center
    const startX = cx + (Math.random() - 0.5) * rect.width * 0.8;
    const startY = cy + (Math.random() - 0.5) * rect.height * 0.4;
    star.style.left = startX + 'px';
    star.style.top = startY + 'px';

    document.body.appendChild(star);

    // Fall: slow start, accelerate down (gravity feel)
    const fallDist = vh - startY + 40 + Math.random() * 60;
    const driftX = (Math.random() - 0.5) * 200;
    const spin = (Math.random() - 0.5) * 540;
    const duration = 1400 + Math.random() * 1000;

    const anim = star.animate([
      {
        transform: `translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(1)`,
        opacity: 1,
        offset: 0
      },
      {
        transform: `translate(-50%, -50%) translate(${driftX * 0.1}px, ${fallDist * 0.02}px) rotate(${spin * 0.05}deg) scale(0.95)`,
        opacity: 1,
        offset: 0.08
      },
      {
        transform: `translate(-50%, -50%) translate(${driftX * 0.25}px, ${fallDist * 0.1}px) rotate(${spin * 0.15}deg) scale(0.9)`,
        opacity: 1,
        offset: 0.2
      },
      {
        transform: `translate(-50%, -50%) translate(${driftX * 0.5}px, ${fallDist * 0.35}px) rotate(${spin * 0.4}deg) scale(0.8)`,
        opacity: 0.8,
        offset: 0.45
      },
      {
        transform: `translate(-50%, -50%) translate(${driftX * 0.8}px, ${fallDist * 0.7}px) rotate(${spin * 0.75}deg) scale(0.6)`,
        opacity: 0.5,
        offset: 0.7
      },
      {
        transform: `translate(-50%, -50%) translate(${driftX}px, ${fallDist}px) rotate(${spin}deg) scale(0.3)`,
        opacity: 0,
        offset: 1
      }
    ], {
      duration,
      delay: Math.random() * 200,
      easing: 'linear',
      fill: 'forwards'
    });

    anim.onfinish = () => star.remove();
  }
}
