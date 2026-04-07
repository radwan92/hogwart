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
    const { data: kid } = await sb.from('kids')
        .select('points').eq('id', kidId).single();
    const newPoints = Math.max(0, kid.points + delta);
    await sb.from('kids').update({ points: newPoints }).eq('id', kidId);
    await sb.from('point_log').insert({ kid_id: kidId, delta, reason });
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
    const { data: kid } = await sb.from('kids')
        .select('points').eq('id', kidId).single();
    if (kid.points < item.cost) return { error: 'Not enough points' };
    const newPoints = kid.points - item.cost;
    await sb.from('kids').update({ points: newPoints }).eq('id', kidId);
    await sb.from('point_log').insert({
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
