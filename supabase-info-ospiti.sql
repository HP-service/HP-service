-- ============================================================================
-- Tabella per pagine Info Ospiti (CMS semplice)
-- Eseguire una sola volta su Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS info_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  icon TEXT DEFAULT 'info',
  content TEXT NOT NULL DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_info_pages_property
  ON info_pages(property_id, sort_order);

ALTER TABLE info_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS info_pages_select ON info_pages;
CREATE POLICY info_pages_select ON info_pages
  FOR SELECT TO authenticated
  USING (property_id = (SELECT property_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS info_pages_all ON info_pages;
CREATE POLICY info_pages_all ON info_pages
  FOR ALL TO authenticated
  USING (property_id = (SELECT property_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (property_id = (SELECT property_id FROM profiles WHERE id = auth.uid()));

-- Lettura pubblica (per portale ospite via slug)
DROP POLICY IF EXISTS info_pages_public_read ON info_pages;
CREATE POLICY info_pages_public_read ON info_pages
  FOR SELECT TO anon
  USING (is_active = true);
