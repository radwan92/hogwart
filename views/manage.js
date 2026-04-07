import { getShopItems, addShopItem, deleteShopItem, getSetting, setSetting, esc, sb, getKids } from '../db.js';

let items = [];
let kids = [];

export function render() {
  return '<div id="manage-view"><div class="spinner-wrap"><div class="spinner"></div></div></div>';
}

export async function init() {
  const [shopItems, timeRatio, k] = await Promise.all([
    getShopItems(),
    getSetting('time_ratio'),
    getKids()
  ]);
  items = shopItems;
  kids = k;

  const el = document.getElementById('manage-view');
  el.innerHTML = `
    <section>
      <h2>Set Stars</h2>
      <div id="manage-kids">
        ${kids.map(kid => `
          <div class="manage-kid">
            <span>${esc(kid.name)}</span>
            <input type="number" class="kid-points-input" data-id="${kid.id}" value="${kid.points}" min="0">
            <button class="set-points-btn" data-id="${kid.id}">Set</button>
          </div>
        `).join('')}
      </div>
    </section>
    <section>
      <h2>Shop Items</h2>
      <div id="manage-items"></div>
      <h3>Add New Item</h3>
      <form id="add-item-form">
        <input type="text" id="item-name" placeholder="Item name" required>
        <input type="text" id="item-image" placeholder="Image URL (optional)">
        <input type="number" id="item-cost" placeholder="Cost" required min="1">
        <button type="submit">Add</button>
      </form>
    </section>
    <section>
      <h2>Settings</h2>
      <label>
        Points per minute:
        <input type="number" id="time-ratio" value="${timeRatio || 1}" min="0.1" step="0.1">
      </label>
      <button id="save-settings">Save</button>
    </section>
  `;

  renderItems();

  // Set stars directly
  el.querySelectorAll('.set-points-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const kidId = btn.dataset.id;
      const input = el.querySelector(`.kid-points-input[data-id="${kidId}"]`);
      const newPoints = Math.max(0, parseInt(input.value) || 0);
      const { error } = await sb.from('kids').update({ points: newPoints }).eq('id', kidId);
      if (error) { alert('Failed to update'); return; }
      btn.textContent = 'Saved!';
      setTimeout(() => btn.textContent = 'Set', 1500);
    });
  });

  document.getElementById('add-item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('item-name').value;
    const image = document.getElementById('item-image').value;
    const cost = parseInt(document.getElementById('item-cost').value);
    await addShopItem(name, image || null, cost);
    items = await getShopItems();
    renderItems();
    e.target.reset();
  });

  document.getElementById('save-settings').addEventListener('click', async () => {
    await setSetting('time_ratio', document.getElementById('time-ratio').value);
    alert('Settings saved');
  });
}

function renderItems() {
  const container = document.getElementById('manage-items');
  if (items.length === 0) {
    container.innerHTML = '<p>No items yet.</p>';
    return;
  }
  container.innerHTML = items.map(item => `
    <div class="manage-item">
      <span>${esc(item.name)} &mdash; ${item.cost} pts</span>
      <button class="delete-btn" data-id="${item.id}">Delete</button>
    </div>
  `).join('');

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this item?')) return;
      await deleteShopItem(btn.dataset.id);
      items = await getShopItems();
      renderItems();
    });
  });
}
