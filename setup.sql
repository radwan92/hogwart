-- Hogwart Points System — Supabase Setup
-- Run this entire script in the Supabase SQL Editor (supabase.com > your project > SQL Editor)

-- Kids table
CREATE TABLE kids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE kids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON kids FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default kids
INSERT INTO kids (name) VALUES ('Lea'), ('Stefan');

-- Shop items table
CREATE TABLE shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  cost integer NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON shop_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Point log table
CREATE TABLE point_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id uuid REFERENCES kids(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE point_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON point_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Settings table
CREATE TABLE settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Default settings
INSERT INTO settings (key, value) VALUES ('time_ratio', '1');
