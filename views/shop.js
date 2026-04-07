import { getKids, getShopItems, buyItem, esc, renderStarIcons, avatarFor } from '../db.js';

let kids = [];
let items = [];
let selectedKid = null;

export function render() {
  return '<div id="shop-view"><div class="spinner-wrap"><div class="spinner"></div></div></div>';
}

export async function init() {
  selectedKid = null;
  [kids, items] = await Promise.all([getKids(), getShopItems()]);
  const el = document.getElementById('shop-view');

  if (items.length === 0) {
    el.innerHTML = '<p>No items in the shop yet. Add some in the Manage tab.</p>';
    return;
  }

  el.innerHTML = `
    <div class="kid-selector">
      ${kids.map(k =>
        `<button class="kid-btn" data-id="${k.id}">
          <span class="kid-btn-name">${avatarFor(k.name) ? `<img class="kid-avatar-sm" src="${avatarFor(k.name)}" alt="">` : ''}${esc(k.name)}</span>
          <span class="kid-btn-stars">${renderStarIcons(k.points, 'star-sm')}</span>
        </button>`
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

function safeImageUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? esc(url) : null;
  } catch { return null; }
}

function renderItems() {
  const grid = document.getElementById('shop-items');
  grid.innerHTML = items.map(item => {
    const imgUrl = safeImageUrl(item.image_url);
    return `
    <div class="shop-card">
      ${imgUrl
        ? `<img src="${imgUrl}" alt="${esc(item.name)}">`
        : '<div class="no-image">No image</div>'}
      <h3>${esc(item.name)}</h3>
      <div class="item-cost-stars">${renderStarIcons(item.cost, 'star-sm')}</div>
      <p class="item-cost">${item.cost} pts</p>
      <button class="buy-btn" data-id="${item.id}">Buy</button>
    </div>
  `;}).join('');

  grid.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!selectedKid) { alert('Select a kid first'); return; }
      const item = items.find(i => i.id === btn.dataset.id);
      if (selectedKid.points < item.cost) { alert('Not enough points!'); return; }
      if (!confirm(`Buy "${item.name}" for ${item.cost} pts from ${selectedKid.name}'s balance?`)) return;

      const result = await buyItem(selectedKid.id, item);
      if (result.error) { alert(result.error); return; }

      selectedKid.points = result.points;
      // Also update the kid in the kids array
      const kidInArray = kids.find(k => k.id === selectedKid.id);
      if (kidInArray) kidInArray.points = result.points;
      const btn = document.querySelector(`.kid-btn[data-id="${selectedKid.id}"]`);
      btn.innerHTML = `<span class="kid-btn-name">${avatarFor(selectedKid.name) ? `<img class="kid-avatar-sm" src="${avatarFor(selectedKid.name)}" alt="">` : ''}${esc(selectedKid.name)}</span><span class="kid-btn-stars">${renderStarIcons(selectedKid.points, 'star-sm')}</span>`;
    });
  });
}
