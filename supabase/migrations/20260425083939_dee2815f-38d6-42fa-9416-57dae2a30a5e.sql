-- No-show prevention & deposits schema

-- Reservation columns: confirmation/reconfirmation status, no-show risk, deposit policy
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS reconfirmation_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS reconfirmation_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconfirmation_declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS magic_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_risk text,
  ADD COLUMN IF NOT EXISTS no_show_risk_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS deposit_policy_notes text,
  ADD COLUMN IF NOT EXISTS deposit_currency text NOT NULL DEFAULT 'EUR';

-- Validation constraints (loose, allow future statuses)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_confirmation_status_check') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_confirmation_status_check
      CHECK (confirmation_status IN ('not_sent','pending','sent','confirmed','failed','skipped'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_reconfirmation_status_check') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_reconfirmation_status_check
      CHECK (reconfirmation_status IN ('not_required','pending','requested','confirmed','declined','expired'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_no_show_risk_check') THEN
    ALTER TABLE public.reservations ADD CONSTRAINT reservations_no_show_risk_check
      CHECK (no_show_risk IS NULL OR no_show_risk IN ('low','medium','high'));
  END IF;
END $$;

-- Restaurant-level no-show settings (extend existing columns)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS noshow_reconfirmation_hours_before integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS noshow_cancellation_cutoff_minutes integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS noshow_risk_signal_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deposit_default_amount_cents integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS deposit_voucher_credit_possible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deposit_exempt_vip boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deposit_exempt_regulars boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deposit_guest_message text;

-- Reservation reminders queue (clickwise-ready, no real send yet)
CREATE TABLE IF NOT EXISTS public.reservation_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  reminder_type text NOT NULL,
  channel text NOT NULL DEFAULT 'clickwise_workflow',
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  failed_at timestamptz,
  error_message text,
  clickwise_workflow_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservation_reminders_type_check CHECK (
    reminder_type IN ('confirmation','reminder_24h','reminder_2h','reconfirmation',
                      'cancellation_confirmation','change_confirmation','deposit_request')
  ),
  CONSTRAINT reservation_reminders_status_check CHECK (
    status IN ('pending','scheduled','sent','failed','cancelled','skipped')
  ),
  CONSTRAINT reservation_reminders_channel_check CHECK (
    channel IN ('email','whatsapp','sms','clickwise_workflow')
  )
);

CREATE INDEX IF NOT EXISTS idx_reminders_reservation ON public.reservation_reminders(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reminders_restaurant_scheduled ON public.reservation_reminders(restaurant_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_reminders_status_scheduled ON public.reservation_reminders(status, scheduled_for) WHERE status IN ('pending','scheduled');

ALTER TABLE public.reservation_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read reminders" ON public.reservation_reminders;
CREATE POLICY "members read reminders" ON public.reservation_reminders
  FOR SELECT USING (public.is_restaurant_member(restaurant_id));

DROP POLICY IF EXISTS "members write reminders" ON public.reservation_reminders;
CREATE POLICY "members write reminders" ON public.reservation_reminders
  FOR ALL USING (public.is_restaurant_member(restaurant_id))
  WITH CHECK (public.is_restaurant_member(restaurant_id));

DROP TRIGGER IF EXISTS update_reservation_reminders_updated_at ON public.reservation_reminders;
CREATE TRIGGER update_reservation_reminders_updated_at
  BEFORE UPDATE ON public.reservation_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
