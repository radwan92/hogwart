# Hogwart — Household Points System

## Overview
A simple, statically hosted SPA for tracking kids' points. Points can be awarded/deducted by parents, spent in a shop on rewards, or spent as timed screen-time/play-time with a live countdown. Optimized for mobile (portrait + landscape).

## Tech Stack
- Plain HTML + CSS + vanilla JS (ES modules, no frameworks, no build tools)
- Supabase (database + auth) via CDN
- GitHub Pages hosting

## Authentication
- Supabase URL + anon key in source (safe by design)
- One shared Supabase Auth account (email hardcoded, user types password only)
- Site shows a password gate on load; calls `signInWithPassword()`
- RLS on all tables: only `authenticated` role can read/write
- Session persists in localStorage across reloads

## Kids
- **Lea** and **Stefan**
- Each has a name and a point balance
- Stored in DB so it's easy to add/remove kids later

## Visual Design
- Clean, plain white background
- Mobile-first, responsive (portrait + landscape layouts)
- Bottom tab bar with icons on mobile, top bar on desktop
- Points represented as **gold star icons** in rows of 5 (kids can't count — visual representation)
- Small numeric count shown below stars for adults

## Effects & Animations
- **Adding points**: flying stars (button → card), confetti burst from bottom (more points = more confetti), card glows green + shakes, stars fade in one at a time
- **Subtracting points**: falling stars from card, screen shake, card glows red, stars fade out one at a time
- **Optimistic UI**: display updates instantly, reconciles with DB after

## SPA Views (tab-based navigation)

### 1. Login Screen
- Single password field (email is hardcoded/hidden)
- On success, switches to Home

### 2. Home Tab
- Both kids shown side-by-side as tappable cards (name + star grid + number)
- Below: +1/+2/+5/+10 and -1/-2/-5/-10 buttons
- Two interaction flows:
  - Tap kid first → tap point button → awards points
  - Tap point button first → tap kid → awards points
- Selected item highlights until the second tap completes the action
- Landscape: kids on top row, buttons on bottom row

### 3. Shop Tab
- Select a kid first, then browse items
- Displays shop items as cards: image, name, point cost
- "Buy" deducts points and logs the purchase
- Shop items stored in DB

### 4. Time Tab
- Both kids shown simultaneously, each with their own:
  - Circular SVG gauge (color transitions green → yellow → red)
  - Star icon + numeric count in center
  - Orbit of star icons inside the gauge ring (stars fade out and redistribute as points drain)
  - Elapsed time counter (MM:SS)
  - Independent Start/Stop button
- Configurable point-to-minute ratio (default 1:1)
- Smooth gauge depletion (fractional, not stepped)
- Alarm sound (Web Audio API beep pattern) when points reach 0
- Portrait: stacked vertically. Landscape: side by side, compact

### 5. Manage Tab
- Add/edit/delete shop items (name, image URL, cost)
- Configure time-to-points ratio
- Future: manage kids (add/remove/rename)

## Database Schema (Supabase/Postgres)

### `kids`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| name | text | "Lea" or "Stefan" |
| points | integer | Current balance, default 0 |
| created_at | timestamptz | default now() |

### `shop_items`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | Item name |
| image_url | text | URL to item image |
| cost | integer | Point cost |
| active | boolean | default true (soft delete) |
| created_at | timestamptz | default now() |

### `point_log`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| kid_id | uuid | FK -> kids.id |
| delta | integer | +5, -20, etc. |
| reason | text | "manual", "shop:Lego Set", "time:02:30" |
| created_at | timestamptz | default now() |

### `settings`
| Column | Type | Notes |
|--------|------|-------|
| key | text | PK, e.g. "time_ratio" |
| value | text | e.g. "1" (points per minute) |

### RLS (all tables)
```sql
ALTER TABLE kids ENABLE ROW LEVEL SECURITY;
-- Same for shop_items, point_log, settings
-- Policy: TO authenticated USING (true) WITH CHECK (true) for all operations
```

## File Structure
```
index.html          — single HTML file, login + tabbed nav shell
style.css           — all styles (mobile-first + responsive breakpoints)
app.js              — routing, auth flow, tab switching
db.js               — Supabase client + all CRUD helpers
star.png            — star icon used throughout
setup.sql           — SQL to create tables + RLS + seed data
.gitignore
views/
  home.js           — combined dashboard + point awarding
  shop.js           — shop browsing + buying
  time.js           — dual timer with gauges + orbit stars
  manage.js         — shop item admin + settings
```

## Setup Checklist
1. Create Supabase project at supabase.com
2. Disable "Confirm email" in Authentication > Providers > Email
3. Create shared user account (`hogwart@family.local` + password) in Authentication > Users
4. Run `setup.sql` in the SQL Editor
5. Copy Project URL + Anon Key into `db.js`
6. Deploy to GitHub Pages
