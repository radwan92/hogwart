import { getShopItems, addShopItem, deleteShopItem, getSetting, setSetting } from '../db.js';

let items = [];

export function render() {
  return '<div id="manage-view"><div class="spinner-wrap"><div class="spinner"></div></div></div>';
}

export async function init() {
  const [shopItems, timeRatio] = await Promise.all([
    getShopItems(),
    getSetting('time_ratio')
  ]);
  items = shopItems;

  const el = document.getElementById('manage-view');
  el.innerHTML = `
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
      <span>${item.name} &mdash; ${item.cost} pts</span>
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
