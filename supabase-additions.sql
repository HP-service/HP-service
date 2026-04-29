-- ============================================================================
-- HP Service · Aggiunte schema (eseguire DOPO supabase-schema.sql)
-- Idempotente: si può rieseguire senza danni.
-- ============================================================================

-- 1. Colonne aggiuntive su properties (CAP, provincia, CIN)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS province    TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS cin_code    TEXT;  -- Codice Identificativo Nazionale strutture ricettive

-- 2. Aggiunta ruolo SuperAdmin all'enum user_role
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'SuperAdmin'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE user_role ADD VALUE 'SuperAdmin';
  END IF;
END $$;

-- 3. Trigger auto-creazione profilo al signup (se non già esistente)
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, is_active, property_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'Manager',  -- default; SuperAdmin lo imposta manualmente
    true,
    NULL        -- onboarding wizard imposterà property_id
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_auth_user();

-- 4. RLS: gli utenti senza property_id devono comunque poter creare la prima property
--    (durante onboarding). Policy permissiva: insert proprio per utenti autenticati senza property.
DROP POLICY IF EXISTS "users_can_create_first_property" ON properties;
CREATE POLICY "users_can_create_first_property" ON properties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND property_id IS NOT NULL
    )
  );

-- 5. RLS: l'utente può leggere/aggiornare il proprio profilo anche se property_id è NULL
DROP POLICY IF EXISTS "users_read_own_profile_always" ON profiles;
CREATE POLICY "users_read_own_profile_always" ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_profile_always" ON profiles;
CREATE POLICY "users_update_own_profile_always" ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
