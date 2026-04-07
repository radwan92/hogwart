import { getSession, signIn, signOut } from './db.js';
import * as home    from './views/home.js';
import * as shop    from './views/shop.js';
import * as time    from './views/time.js';
import * as manage  from './views/manage.js';

const views = { home, shop, time, manage };
let currentView = null;

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

async function init() {
  // Check existing session
  const session = await getSession();
  if (session) showApp();

  // Login handlers
  $('#login-btn').addEventListener('click', handleLogin);
  $('#login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Tab navigation
  $$('.tab[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => showView(tab.dataset.tab));
  });

  // Logout
  $('#logout-btn').addEventListener('click', async () => {
    await signOut();
    location.reload();
  });
}

async function handleLogin() {
  const password = $('#login-password').value;
  if (!password) return;
  $('#login-btn').disabled = true;
  const { error } = await signIn(password);
  $('#login-btn').disabled = false;
  if (error) {
    $('#login-error').textContent = 'Wrong password';
    $('#login-error').classList.remove('hidden');
  } else {
    showApp();
  }
}

function showApp() {
  $('#login-view').classList.add('hidden');
  $('#main-view').classList.remove('hidden');
  showView('home');
}

async function showView(name) {
  if (currentView && currentView.destroy) currentView.destroy();

  // Update active tab
  $$('.tab[data-tab]').forEach(t => t.classList.remove('active'));
  const activeTab = $(`.tab[data-tab="${name}"]`);
  if (activeTab) activeTab.classList.add('active');

  currentView = views[name];
  const content = $('#content');
  content.innerHTML = currentView.render();
  // Force DOM update before running init
  content.offsetHeight;
  if (currentView.init) await currentView.init();
}

init();
