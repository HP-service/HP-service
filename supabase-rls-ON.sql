-- ============================================================================
-- Riabilita RLS su tutte le tabelle pubbliche esistenti
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
  END LOOP;
END $$;

SELECT 'RLS riabilitato su tutte le tabelle pubbliche' AS status;
