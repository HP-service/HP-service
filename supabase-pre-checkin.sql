-- ============================================================================
-- Pre check-in digitale: token per booking + dati guest precompilati dall'ospite
-- ============================================================================

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pre_checkin_token TEXT UNIQUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pre_checkin_completed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pre_checkin_data JSONB;

CREATE INDEX IF NOT EXISTS idx_bookings_precheck_token
  ON bookings(pre_checkin_token) WHERE pre_checkin_token IS NOT NULL;

-- Funzione che genera il token al volo (idempotente)
CREATE OR REPLACE FUNCTION public.generate_precheckin_token(p_booking_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT pre_checkin_token INTO v_token FROM bookings WHERE id = p_booking_id;
  IF v_token IS NULL THEN
    v_token := encode(gen_random_bytes(18), 'base64');
    v_token := replace(replace(replace(v_token, '/', '-'), '+', '_'), '=', '');
    UPDATE bookings SET pre_checkin_token = v_token WHERE id = p_booking_id;
  END IF;
  RETURN v_token;
END $$;

GRANT EXECUTE ON FUNCTION public.generate_precheckin_token(UUID) TO authenticated;

-- Funzione che salva i dati pre check-in (chiamata dal client pubblico — anon)
CREATE OR REPLACE FUNCTION public.submit_precheckin(
  p_token TEXT,
  p_data JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE bookings
     SET pre_checkin_data = p_data,
         pre_checkin_completed_at = NOW()
   WHERE pre_checkin_token = p_token
     AND pre_checkin_completed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END $$;

GRANT EXECUTE ON FUNCTION public.submit_precheckin(TEXT, JSONB) TO anon, authenticated;

-- Funzione per leggere i dati booking da token (anon-safe, ritorna solo info necessarie)
CREATE OR REPLACE FUNCTION public.get_precheckin_booking(p_token TEXT)
RETURNS TABLE (
  property_name TEXT,
  property_address TEXT,
  property_city TEXT,
  check_in DATE,
  check_out DATE,
  adults INT,
  children INT,
  booking_number TEXT,
  completed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.name,
    p.address,
    p.city,
    b.check_in,
    b.check_out,
    b.adults,
    b.children,
    b.booking_number,
    b.pre_checkin_completed_at IS NOT NULL
  FROM bookings b
  JOIN properties p ON p.id = b.property_id
  WHERE b.pre_checkin_token = p_token
  LIMIT 1;
END $$;

GRANT EXECUTE ON FUNCTION public.get_precheckin_booking(TEXT) TO anon, authenticated;
