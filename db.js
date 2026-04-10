// ============================================================
// Supabase Configuration — replace these with your project values
// (found at: supabase.com > your project > Settings > API)
// ============================================================
const SUPABASE_URL = 'https://wqkcsbrwkhzvapgfteaj.supabase.co';
const SUPABASE_ANON = 'sb_publishable_IJSMPliQ5PI_hOKbysJ_OA_o8v6m7Mn';

// The email of the shared auth account you created in Supabase Auth.
// Users only need to type the password — this email is used behind the scenes.
const AUTH_EMAIL = 'hogwart@family.local';

// ============================================================

const { createClient } = window.supabase;
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// HTML escape helper — use on all DB strings before inserting into innerHTML
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(str) {
  return String(str).replace(/[&<>"']/g, c => ESC_MAP[c]);
}

// ---- Kid avatars ----

const AVATARS = {
  'Lea': 'assets/girl.png',
  'Stefan': 'assets/boy.png',
};

export function avatarFor(name) {
  return AVATARS[name] || null;
}

// ---- Star rendering (mega=100, super=10, normal=1) ----

export const STARS = {
  mega:  'assets/mega_star.png',
  super: 'assets/super_star.png',
  normal: 'assets/star.png',
};

// Break a point count into mega/super/normal stars
export function starBreakdown(points) {
  const mega = Math.floor(points / 100);
  const sup  = Math.floor((points % 100) / 10);
  const norm = points % 10;
  return { mega, super: sup, normal: norm };
}

// Render stars as HTML (inline, no grid — just icons in order)
export function renderStarIcons(points, cssClass = 'star') {
  if (points <= 0) return '';
  const b = starBreakdown(points);
  let html = '';
  for (let i = 0; i < b.mega; i++)
    html += `<img class="${cssClass} star-mega" src="${STARS.mega}" alt="">`;
  for (let i = 0; i < b.super; i++)
    html += `<img class="${cssClass} star-super" src="${STARS.super}" alt="">`;
  for (let i = 0; i < b.normal; i++)
    html += `<img class="${cssClass}" src="${STARS.normal}" alt="">`;
  return html;
}

// ---- Auth ----

export async function signIn(password) {
    return sb.auth.signInWithPassword({ email: AUTH_EMAIL, password });
}

export async function signOut() {
    return sb.auth.signOut();
}

export async function getSession() {
    const { data: { session } } = await sb.auth.getSession();
    return session;
}

// ---- Kids ----

export async function getKids() {
    const { data } = await sb.from('kids').select('*').order('name');
    return data || [];
}

export async function updatePoints(kidId, delta, reason) {
    const { data: kid, error } = await sb.from('kids')
        .select('points').eq('id', kidId).single();
    if (error || !kid) throw new Error('Could not load kid points');
    const newPoints = Math.max(0, kid.points + delta);
    const { error: updateErr } = await sb.from('kids')
        .update({ points: newPoints }).eq('id', kidId);
    if (updateErr) throw new Error('Could not update points');
    // Log is best-effort — don't block on failure
    sb.from('point_log').insert({ kid_id: kidId, delta, reason });
    return newPoints;
}

// ---- Shop Items ----

export async function getShopItems() {
    const { data } = await sb.from('shop_items')
        .select('*').eq('active', true).order('name');
    return data || [];
}

export async function addShopItem(name, imageUrl, cost) {
    return sb.from('shop_items').insert({ name, image_url: imageUrl, cost });
}

export async function updateShopItem(id, updates) {
    return sb.from('shop_items').update(updates).eq('id', id);
}

export async function deleteShopItem(id) {
    return sb.from('shop_items').update({ active: false }).eq('id', id);
}

export async function buyItem(kidId, item) {
    const { data: kid, error } = await sb.from('kids')
        .select('points').eq('id', kidId).single();
    if (error || !kid) throw new Error('Could not load kid points');
    if (kid.points < item.cost) return { error: 'Not enough points' };
    const newPoints = kid.points - item.cost;
    const { error: updateErr } = await sb.from('kids')
        .update({ points: newPoints }).eq('id', kidId);
    if (updateErr) throw new Error('Could not update points');
    sb.from('point_log').insert({
        kid_id: kidId, delta: -item.cost, reason: `shop:${item.name}`
    });
    return { points: newPoints };
}

// ---- Point Log ----

export async function getPointLog(kidId, limit = 20) {
    let query = sb.from('point_log')
        .select('*, kids(name)')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (kidId) query = query.eq('kid_id', kidId);
    const { data } = await query;
    return data || [];
}

// ---- Settings ----

export async function getSetting(key) {
    const { data } = await sb.from('settings')
        .select('value').eq('key', key).single();
    return data?.value;
}

export async function setSetting(key, value) {
    return sb.from('settings').upsert({ key, value: String(value) });
}
