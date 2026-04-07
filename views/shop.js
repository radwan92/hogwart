import { getKids, getShopItems, buyItem } from '../db.js';

let kids = [];
let items = [];
let selectedKid = null;

export function render() {
  return '<div id="shop-view"><div class="spinner-wrap"><div class="spinner"></div></div></div>';
}

export async function init() {
  [kids, items] = await Promise.all([getKids(), getShopItems()]);
  const el = document.getElementById('shop-view');

  if (items.length === 0) {
    el.innerHTML = '<p>No items in the shop yet. Add some in the Manage tab.</p>';
    return;
  }

  el.innerHTML = `
    <div class="kid-selector">
      ${kids.map(k =>
        `<button class="kid-btn" data-id="${k.id}">${k.name} (${k.points} pts)</button>`
      ).join('')}
    </div>
    <div id="shop-items" class="shop-grid"></div>
  `;

  renderItems();

  el.querySelectorAll('.kid-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedKid = kids.find(k => k.id === btn.dataset.id);
      el.querySelectorAll('.kid-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function renderItems() {
  const grid = document.getElementById('shop-items');
  grid.innerHTML = items.map(item => `
    <div class="shop-card">
      ${item.image_url
        ? `<img src="${item.image_url}" alt="${item.name}">`
        : '<div class="no-image">No image</div>'}
      <h3>${item.name}</h3>
      <p class="item-cost">${item.cost} pts</p>
      <button class="buy-btn" data-id="${item.id}">Buy</button>
    </div>
  `).join('');

  grid.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!selectedKid) { alert('Select a kid first'); return; }
      const item = items.find(i => i.id === btn.dataset.id);
      if (selectedKid.points < item.cost) { alert('Not enough points!'); return; }
      if (!confirm(`Buy "${item.name}" for ${item.cost} pts from ${selectedKid.name}'s balance?`)) return;

      const result = await buyItem(selectedKid.id, item);
      if (result.error) { alert(result.error); return; }

      selectedKid.points = result.points;
      document.querySelector(`.kid-btn[data-id="${selectedKid.id}"]`).textContent =
        `${selectedKid.name} (${selectedKid.points} pts)`;
    });
  });
}
