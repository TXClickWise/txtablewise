-- 1. Extend reservation_channel enum
ALTER TYPE reservation_channel ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE reservation_channel ADD VALUE IF NOT EXISTS 'instagram';
ALTER TYPE reservation_channel ADD VALUE IF NOT EXISTS 'google';
ALTER TYPE reservation_channel ADD VALUE IF NOT EXISTS 'qr_table';
ALTER TYPE reservation_channel ADD VALUE IF NOT EXISTS 'walkin_qr';
ALTER TYPE reservation_channel ADD VALUE IF NOT EXISTS 'partner';
ALTER TYPE reservation_channel ADD VALUE IF NOT EXISTS 'returning_guest';

-- 2. New enums
DO $$ BEGIN
  CREATE TYPE deposit_status AS ENUM ('not_required','pending','authorized','captured','released','forfeited','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE waitlist_status AS ENUM ('waiting','notified','converted','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pos_provider AS ENUM ('loyverse','lightspeed','square','untill','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pos_connection_status AS ENUM ('pending','connected','error','disconnected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_request_status AS ENUM ('pending','sent','responded','skipped','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Reservations: extra kolommen
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS cancel_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS manage_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_status deposit_status NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS deposit_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_label text;

CREATE INDEX IF NOT EXISTS idx_reservations_cancel_token ON public.reservations(cancel_token);
CREATE INDEX IF NOT EXISTS idx_reservations_manage_token ON public.reservations(manage_token);
CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_date ON public.reservations(restaurant_id, reservation_date);

-- 4. Waitlist
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  guest_id uuid,
  first_name text NOT NULL,
  last_name text,
  email text,
  phone text,
  party_size integer NOT NULL CHECK (party_size > 0),
  desired_date date NOT NULL,
  desired_time_from time NOT NULL,
  desired_time_to time NOT NULL,
  flexible_minutes integer NOT NULL DEFAULT 30,
  status waitlist_status NOT NULL DEFAULT 'waiting',
  notified_at timestamptz,
  converted_reservation_id uuid,
  notes text,
  language text NOT NULL DEFAULT 'nl',
  marketing_consent boolean NOT NULL DEFAULT false,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  channel reservation_channel NOT NULL DEFAULT 'online',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_waitlist_restaurant_date ON public.waitlist_entries(restaurant_id, desired_date, status);
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read waitlist" ON public.waitlist_entries
  FOR SELECT USING (is_restaurant_member(restaurant_id));
CREATE POLICY "members write waitlist" ON public.waitlist_entries
  FOR ALL USING (is_restaurant_member(restaurant_id))
  WITH CHECK (is_restaurant_member(restaurant_id));
CREATE POLICY "public submit waitlist" ON public.waitlist_entries
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    party_size > 0
    AND length(coalesce(first_name,'')) > 0
    AND EXISTS (SELECT 1 FROM restaurants r WHERE r.id = waitlist_entries.restaurant_id)
  );

CREATE TRIGGER trg_waitlist_updated BEFORE UPDATE ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Deposit policies
CREATE TABLE IF NOT EXISTS public.deposit_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  min_party_size integer NOT NULL DEFAULT 1,
  applies_friday_saturday_only boolean NOT NULL DEFAULT false,
  applies_to_special_dates boolean NOT NULL DEFAULT false,
  amount_cents_per_guest integer NOT NULL DEFAULT 0,
  refundable_until_hours_before integer NOT NULL DEFAULT 24,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deposit_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read deposit_policies" ON public.deposit_policies
  FOR SELECT USING (is_restaurant_member(restaurant_id));
CREATE POLICY "manager write deposit_policies" ON public.deposit_policies
  FOR ALL USING (is_restaurant_manager(restaurant_id))
  WITH CHECK (is_restaurant_manager(restaurant_id));
CREATE TRIGGER trg_deposit_policies_updated BEFORE UPDATE ON public.deposit_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Restaurant modules (feature flags)
CREATE TABLE IF NOT EXISTS public.restaurant_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  module_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, module_key)
);
ALTER TABLE public.restaurant_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read modules" ON public.restaurant_modules
  FOR SELECT USING (is_restaurant_member(restaurant_id));
CREATE POLICY "manager write modules" ON public.restaurant_modules
  FOR ALL USING (is_restaurant_manager(restaurant_id))
  WITH CHECK (is_restaurant_manager(restaurant_id));
CREATE TRIGGER trg_modules_updated BEFORE UPDATE ON public.restaurant_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. POS connections
CREATE TABLE IF NOT EXISTS public.pos_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  provider pos_provider NOT NULL,
  status pos_connection_status NOT NULL DEFAULT 'pending',
  display_name text,
  external_account_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pos_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager read pos" ON public.pos_connections
  FOR SELECT USING (is_restaurant_manager(restaurant_id));
CREATE POLICY "manager write pos" ON public.pos_connections
  FOR ALL USING (is_restaurant_manager(restaurant_id))
  WITH CHECK (is_restaurant_manager(restaurant_id));
CREATE TRIGGER trg_pos_connections_updated BEFORE UPDATE ON public.pos_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. POS orders (omzet gekoppeld aan reservering of tafel)
CREATE TABLE IF NOT EXISTS public.pos_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  pos_connection_id uuid,
  reservation_id uuid,
  table_id uuid,
  external_order_id text,
  opened_at timestamptz,
  closed_at timestamptz,
  guest_count integer,
  subtotal_cents integer NOT NULL DEFAULT 0,
  tip_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pos_orders_restaurant ON public.pos_orders(restaurant_id, closed_at);
CREATE INDEX IF NOT EXISTS idx_pos_orders_reservation ON public.pos_orders(reservation_id);
ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read pos_orders" ON public.pos_orders
  FOR SELECT USING (is_restaurant_member(restaurant_id));
CREATE POLICY "manager write pos_orders" ON public.pos_orders
  FOR ALL USING (is_restaurant_manager(restaurant_id))
  WITH CHECK (is_restaurant_manager(restaurant_id));
CREATE TRIGGER trg_pos_orders_updated BEFORE UPDATE ON public.pos_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Review requests (aftercare)
CREATE TABLE IF NOT EXISTS public.review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  guest_id uuid,
  status review_request_status NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  responded_at timestamptz,
  satisfaction smallint,
  feedback_text text,
  routed_to text,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_requests_token ON public.review_requests(token);
CREATE INDEX IF NOT EXISTS idx_review_requests_due ON public.review_requests(status, scheduled_for);
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read reviews" ON public.review_requests
  FOR SELECT USING (is_restaurant_member(restaurant_id));
CREATE POLICY "manager write reviews" ON public.review_requests
  FOR ALL USING (is_restaurant_manager(restaurant_id))
  WITH CHECK (is_restaurant_manager(restaurant_id));
CREATE TRIGGER trg_review_requests_updated BEFORE UPDATE ON public.review_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();