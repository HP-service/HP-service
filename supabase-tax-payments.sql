-- ============================================================================
-- Storico versamenti tassa di soggiorno (F24)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tourist_tax_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  period_month TEXT NOT NULL, -- YYYY-MM
  amount NUMERIC(10, 2) NOT NULL,
  paid_at DATE NOT NULL,
  payment_method TEXT, -- 'F24' | 'PagoPA' | 'BonificoBancario' | 'Altro'
  reference TEXT, -- numero protocollo / CRO
  notes TEXT,
  receipt_url TEXT, -- link a PDF ricevuta caricata su Storage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT tourist_tax_payments_period_unique UNIQUE (property_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_tourist_tax_payments_property_period
  ON public.tourist_tax_payments(property_id, period_month);

-- RLS
ALTER TABLE public.tourist_tax_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tourist_tax_payments_select ON public.tourist_tax_payments;
CREATE POLICY tourist_tax_payments_select ON public.tourist_tax_payments
  FOR SELECT
  USING (property_id IN (SELECT property_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS tourist_tax_payments_insert ON public.tourist_tax_payments;
CREATE POLICY tourist_tax_payments_insert ON public.tourist_tax_payments
  FOR INSERT
  WITH CHECK (property_id IN (SELECT property_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS tourist_tax_payments_update ON public.tourist_tax_payments;
CREATE POLICY tourist_tax_payments_update ON public.tourist_tax_payments
  FOR UPDATE
  USING (property_id IN (SELECT property_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS tourist_tax_payments_delete ON public.tourist_tax_payments;
CREATE POLICY tourist_tax_payments_delete ON public.tourist_tax_payments
  FOR DELETE
  USING (property_id IN (SELECT property_id FROM public.profiles WHERE id = auth.uid()));
