-- ============================================================================
-- Templates messaggi (email/WhatsApp/SMS) per pre-arrivo, post-checkout, custom
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('PreArrival', 'PostCheckout', 'Welcome', 'Custom')),
  channel TEXT NOT NULL DEFAULT 'Email' CHECK (channel IN ('Email', 'WhatsApp', 'SMS')),
  subject TEXT, -- solo per Email
  body TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_property
  ON public.message_templates(property_id, kind);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_templates_all ON public.message_templates;
CREATE POLICY message_templates_all ON public.message_templates
  FOR ALL TO authenticated
  USING (property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (property_id = (SELECT property_id FROM public.profiles WHERE id = auth.uid()));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS message_templates_updated_at ON public.message_templates;
CREATE TRIGGER message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
