import { getKids, updatePoints } from '../db.js';

let kids = [];
let selectedKid = null;

export function render() {
  return '<div id="points-view"><div class="spinner-wrap"><div class="spinner"></div></div></div>';
}

export async function init() {
  kids = await getKids();
  const el = document.getElementById('points-view');

  el.innerHTML = `
    <div class="kid-selector">
      ${kids.map(k => `<button class="kid-btn" data-id="${k.id}">${k.name}</button>`).join('')}
    </div>
    <div id="selected-kid" class="hidden">
      <h2 id="kid-name"></h2>
      <div class="points-display" id="kid-points"></div>
      <div class="point-buttons">
        <div class="add-buttons">
          ${[1, 2, 5, 10].map(n =>
            `<button class="btn-add" data-delta="${n}">+${n}</button>`
          ).join('')}
        </div>
        <div class="sub-buttons">
          ${[1, 2, 5, 10].map(n =>
            `<button class="btn-sub" data-delta="-${n}">&minus;${n}</button>`
          ).join('')}
        </div>
      </div>
    </div>
  `;

  el.querySelectorAll('.kid-btn').forEach(btn => {
    btn.addEventListener('click', () => selectKid(btn.dataset.id));
  });
}

function selectKid(id) {
  selectedKid = kids.find(k => k.id === id);
  document.getElementById('selected-kid').classList.remove('hidden');
  document.getElementById('kid-name').textContent = selectedKid.name;
  document.getElementById('kid-points').textContent = selectedKid.points;

  // Highlight active kid
  document.querySelectorAll('.kid-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.kid-btn[data-id="${id}"]`).classList.add('active');

  // Wire up point buttons
  document.querySelectorAll('.btn-add, .btn-sub').forEach(btn => {
    btn.onclick = async () => {
      const delta = parseInt(btn.dataset.delta);
      const newPoints = await updatePoints(selectedKid.id, delta, 'manual');
      selectedKid.points = newPoints;

      const display = document.getElementById('kid-points');
      display.textContent = newPoints;

      // Flash feedback
      const cls = delta > 0 ? 'flash-green' : 'flash-red';
      display.classList.remove('flash-green', 'flash-red');
      // Force reflow so re-adding the same class retriggers the animation
      void display.offsetWidth;
      display.classList.add(cls);
      setTimeout(() => display.classList.remove(cls), 400);
    };
  });
}
