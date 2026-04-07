import { getKids } from '../db.js';

export function render() {
  return '<div id="dashboard"><div class="spinner-wrap"><div class="spinner"></div></div></div>';
}

export async function init() {
  const kids = await getKids();
  const el = document.getElementById('dashboard');

  el.innerHTML = `<div class="dashboard-grid">${kids.map(kid => `
    <div class="kid-card">
      <h2>${kid.name}</h2>
      <div class="points-display">${kid.points}</div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${Math.min(kid.points, 100)}%"></div>
      </div>
    </div>
  `).join('')}</div>`;
}
