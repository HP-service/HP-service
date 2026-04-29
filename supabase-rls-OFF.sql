-- ============================================================================
-- TEMPORANEO: Disabilita RLS su tutte le tabelle pubbliche esistenti
-- ⚠️ NON usare in produzione. Riabilitare con supabase-rls-ON.sql.
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
    EXECUTE format('ALTER TABLE %I.%I DISABLE ROW LEVEL SECURITY', r.schemaname, r.tablename);
  END LOOP;
END $$;

SELECT 'RLS disabilitato su tutte le tabelle pubbliche' AS status;
