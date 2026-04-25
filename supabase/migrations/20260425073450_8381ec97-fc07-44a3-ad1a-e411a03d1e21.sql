-- =========================================================================
-- TableWise — Database Architecture Phase 2 (additive, non-destructive)
-- Adds: guest_notes, pre_order_items, reservation_status_history, special_days
-- Extends: restaurants, guests, reservations with ClickWise/POS/MVP fields
-- Multi-location is intentionally deferred to a separate phase.
-- =========================================================================

-- ------------------------------------------------------------------------
-- 1. RESTAURANTS — extend with SaaS-level metadata
-- ------------------------------------------------------------------------
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS plan_type text,
  ADD COLUMN IF NOT EXISTS default_language text NOT NULL DEFAULT 'nl',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ------------------------------------------------------------------------
-- 2. GUESTS — extend with ClickWise + source channel hooks
-- ------------------------------------------------------------------------
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS preferred_channel text,
  ADD COLUMN IF NOT EXISTS clickwise_contact_id text,
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS visit_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_visit_at timestamptz,
  ADD COLUMN IF NOT EXISTS dietary_preferences text,
  ADD COLUMN IF NOT EXISTS seating_preferences text,
  ADD COLUMN IF NOT EXISTS hospitality_notes text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_guests_clickwise_contact ON public.guests(clickwise_contact_id) WHERE clickwise_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_phone ON public.guests(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_email ON public.guests(email) WHERE email IS NOT NULL;

-- ------------------------------------------------------------------------
-- 3. RESERVATIONS — extend with ClickWise / POS / large-group hooks
-- NOTE: existing manage_token already serves as the magic link token.
-- ------------------------------------------------------------------------
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS requires_manual_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS large_group_status text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconfirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS clickwise_contact_id text,
  ADD COLUMN IF NOT EXISTS clickwise_workflow_status text,
  ADD COLUMN IF NOT EXISTS external_reference text,
  ADD COLUMN IF NOT EXISTS pos_provider text,
  ADD COLUMN IF NOT EXISTS pos_order_id text,
  ADD COLUMN IF NOT EXISTS pos_receipt_id text,
  ADD COLUMN IF NOT EXISTS receipt_total numeric(10,2),
  ADD COLUMN IF NOT EXISTS payment_status text;

-- soft-validate large_group_status values (subset)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reservations_large_group_status_check'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_large_group_status_check
      CHECK (large_group_status IS NULL OR large_group_status IN
        ('request_received','awaiting_approval','awaiting_deposit','approved','declined'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reservations_clickwise_contact ON public.reservations(clickwise_contact_id) WHERE clickwise_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_pos_receipt ON public.reservations(pos_receipt_id) WHERE pos_receipt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_manage_token ON public.reservations(manage_token) WHERE manage_token IS NOT NULL;

-- ------------------------------------------------------------------------
-- 4. GUEST_NOTES — hospitality notes per guest (separate from guest.notes)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guest_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  guest_id uuid NOT NULL,
  note text NOT NULL,
  note_type text,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guest_notes_guest ON public.guest_notes(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_notes_restaurant ON public.guest_notes(restaurant_id);

ALTER TABLE public.guest_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read guest notes" ON public.guest_notes
  FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "members write guest notes" ON public.guest_notes
  FOR ALL USING (public.is_restaurant_member(restaurant_id))
  WITH CHECK (public.is_restaurant_member(restaurant_id));

-- ------------------------------------------------------------------------
-- 5. PRE_ORDER_ITEMS — catalogus van bestelbare items per restaurant
-- (existing pre_orders table = lijnen per reservering, blijft bestaan)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pre_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  category text,
  price_cents integer,
  is_active boolean NOT NULL DEFAULT true,
  requires_payment boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_pre_order_items_restaurant ON public.pre_order_items(restaurant_id) WHERE deleted_at IS NULL;

ALTER TABLE public.pre_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read pre_order_items" ON public.pre_order_items
  FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "manager write pre_order_items" ON public.pre_order_items
  FOR ALL USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

CREATE TRIGGER update_pre_order_items_updated_at
  BEFORE UPDATE ON public.pre_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Optional link from pre_orders lines to a catalog item (nullable, additive)
ALTER TABLE public.pre_orders
  ADD COLUMN IF NOT EXISTS pre_order_item_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'requested';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pre_orders_status_check'
  ) THEN
    ALTER TABLE public.pre_orders
      ADD CONSTRAINT pre_orders_status_check
      CHECK (status IN ('requested','confirmed','prepared','served','cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pre_orders_item ON public.pre_orders(pre_order_item_id) WHERE pre_order_item_id IS NOT NULL;

-- ------------------------------------------------------------------------
-- 6. RESERVATION_STATUS_HISTORY — auditable status transitions
-- (separate from generic audit_log for fast per-reservation timeline)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservation_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  reservation_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  changed_by_type text NOT NULL DEFAULT 'user',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rsh_changed_by_type_check') THEN
    ALTER TABLE public.reservation_status_history
      ADD CONSTRAINT rsh_changed_by_type_check
      CHECK (changed_by_type IN ('user','guest','ai_agent','system','integration'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rsh_reservation ON public.reservation_status_history(reservation_id);
CREATE INDEX IF NOT EXISTS idx_rsh_restaurant ON public.reservation_status_history(restaurant_id);

ALTER TABLE public.reservation_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read rsh" ON public.reservation_status_history
  FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "members insert rsh" ON public.reservation_status_history
  FOR INSERT WITH CHECK (public.is_restaurant_member(restaurant_id));
-- intentionally no UPDATE/DELETE — history is append-only

-- ------------------------------------------------------------------------
-- 7. SPECIAL_DAYS — afwijkende openingstijden / events
-- (closures table blijft voor pure sluitingen; special_days = uitzonderingen MET tijden)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.special_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  date date NOT NULL,
  name text NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  opens_at time,
  closes_at time,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_special_days_restaurant_date ON public.special_days(restaurant_id, date);

ALTER TABLE public.special_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read special_days" ON public.special_days
  FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "manager write special_days" ON public.special_days
  FOR ALL USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

CREATE TRIGGER update_special_days_updated_at
  BEFORE UPDATE ON public.special_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------------------
-- 8. AUTO-LOG status changes on reservations into reservation_status_history
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_reservation_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.reservation_status_history
      (restaurant_id, reservation_id, old_status, new_status, changed_by, changed_by_type)
    VALUES
      (NEW.restaurant_id, NEW.id, OLD.status::text, NEW.status::text,
       auth.uid(), CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END);
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.reservation_status_history
      (restaurant_id, reservation_id, old_status, new_status, changed_by, changed_by_type)
    VALUES
      (NEW.restaurant_id, NEW.id, NULL, NEW.status::text,
       auth.uid(), CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'user' END);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservations_status_history_trg ON public.reservations;
CREATE TRIGGER reservations_status_history_trg
  AFTER INSERT OR UPDATE OF status ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.log_reservation_status_change();
