-- ============================================================================
-- FIX onboarding RLS — eseguire SUBITO sul SQL Editor di Supabase
-- Crea una funzione SECURITY DEFINER che bypassa RLS solo per il setup iniziale.
-- ============================================================================

-- 1. Garantisce che esista un profilo per ogni utente già creato
INSERT INTO public.profiles (id, full_name, email, role, is_active, property_id)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.email,
  'Manager',
  true,
  NULL
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 2. Funzione SECURITY DEFINER che crea property + collega al profilo
--    Bypassando RLS perché gira con i privilegi del proprietario.
CREATE OR REPLACE FUNCTION public.setup_property(
  p_name TEXT,
  p_address TEXT,
  p_city TEXT,
  p_postal_code TEXT,
  p_province TEXT,
  p_country TEXT,
  p_vat_number TEXT,
  p_cin_code TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_full_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_property_id UUID;
  v_existing UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;

  -- Idempotenza: se già ha una property, ritorna quella
  SELECT property_id INTO v_existing FROM profiles WHERE id = v_user_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Crea property
  INSERT INTO properties (
    name, address, city, country, phone, email, vat_number,
    postal_code, province, cin_code
  )
  VALUES (
    p_name, p_address, p_city,
    COALESCE(NULLIF(p_country, ''), 'IT'),
    NULLIF(p_phone, ''),
    NULLIF(p_email, ''),
    NULLIF(p_vat_number, ''),
    NULLIF(p_postal_code, ''),
    NULLIF(p_province, ''),
    NULLIF(p_cin_code, '')
  )
  RETURNING id INTO v_property_id;

  -- Aggiorna o crea profilo
  INSERT INTO profiles (id, full_name, email, role, is_active, property_id)
  VALUES (
    v_user_id,
    p_full_name,
    (SELECT email FROM auth.users WHERE id = v_user_id),
    'Manager',
    true,
    v_property_id
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      property_id = EXCLUDED.property_id,
      role = 'Manager',
      is_active = true;

  RETURN v_property_id;
END $$;

-- 3. Permesso esecuzione per utenti autenticati
GRANT EXECUTE ON FUNCTION public.setup_property(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
