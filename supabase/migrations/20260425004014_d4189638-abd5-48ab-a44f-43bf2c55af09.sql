
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('owner', 'manager', 'host', 'staff');
CREATE TYPE public.reservation_status AS ENUM ('hold', 'pending', 'confirmed', 'seated', 'finished', 'no_show', 'cancelled');
CREATE TYPE public.reservation_channel AS ENUM ('online', 'phone', 'walk_in', 'ai_host', 'manager', 'clickwise', 'import');
CREATE TYPE public.large_group_status AS ENUM ('new', 'in_progress', 'confirmed', 'declined');
CREATE TYPE public.integration_event_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE public.weekday AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');

-- ============ TIMESTAMP HELPER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  locale TEXT NOT NULL DEFAULT 'nl',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RESTAURANTS ============
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  locale TEXT NOT NULL DEFAULT 'nl',
  email TEXT,
  phone TEXT,
  address_line1 TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'NL',
  brand_primary TEXT,
  brand_accent TEXT,
  logo_url TEXT,
  slot_duration_minutes INT NOT NULL DEFAULT 15,
  default_reservation_minutes INT NOT NULL DEFAULT 105,
  max_party_size_online INT NOT NULL DEFAULT 8,
  large_group_threshold INT NOT NULL DEFAULT 9,
  hold_minutes INT NOT NULL DEFAULT 10,
  booking_lead_time_minutes INT NOT NULL DEFAULT 60,
  booking_horizon_days INT NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_restaurants_updated BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RESTAURANT MEMBERS ============
CREATE TABLE public.restaurant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id)
);
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY HELPERS ============
CREATE OR REPLACE FUNCTION public.is_restaurant_member(_restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.restaurant_members WHERE restaurant_id = _restaurant_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_restaurant_role(_restaurant_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.restaurant_members
                 WHERE restaurant_id = _restaurant_id AND user_id = auth.uid() AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_restaurant_manager(_restaurant_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.restaurant_members
                 WHERE restaurant_id = _restaurant_id AND user_id = auth.uid()
                 AND role IN ('owner','manager'));
$$;

-- Restaurants policies
CREATE POLICY "members read restaurant" ON public.restaurants FOR SELECT USING (public.is_restaurant_member(id));
CREATE POLICY "managers update restaurant" ON public.restaurants FOR UPDATE USING (public.is_restaurant_manager(id));
CREATE POLICY "authenticated insert restaurant" ON public.restaurants FOR INSERT TO authenticated WITH CHECK (true);

-- Members policies
CREATE POLICY "members read members" ON public.restaurant_members FOR SELECT
  USING (public.is_restaurant_member(restaurant_id) OR user_id = auth.uid());
CREATE POLICY "manager manage members" ON public.restaurant_members FOR ALL
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));
-- Allow first member (owner) bootstrap on restaurant create
CREATE POLICY "self insert as owner" ON public.restaurant_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============ OPENING HOURS ============
CREATE TABLE public.opening_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  weekday public.weekday NOT NULL,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read hours" ON public.opening_hours FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "manager write hours" ON public.opening_hours FOR ALL
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));
CREATE TRIGGER trg_oh_updated BEFORE UPDATE ON public.opening_hours FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SHIFTS ============
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  weekdays public.weekday[] NOT NULL DEFAULT '{}',
  max_guests INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read shifts" ON public.shifts FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "manager write shifts" ON public.shifts FOR ALL
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CLOSURES ============
CREATE TABLE public.closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  is_full_day BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read closures" ON public.closures FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "manager write closures" ON public.closures FOR ALL
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));
CREATE TRIGGER trg_closures_updated BEFORE UPDATE ON public.closures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ZONES ============
CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read zones" ON public.zones FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "manager write zones" ON public.zones FOR ALL
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));
CREATE TRIGGER trg_zones_updated BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TABLES ============
CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  capacity_min INT NOT NULL DEFAULT 1,
  capacity_max INT NOT NULL DEFAULT 2,
  shape TEXT NOT NULL DEFAULT 'round',
  pos_x NUMERIC NOT NULL DEFAULT 0,
  pos_y NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC NOT NULL DEFAULT 80,
  height NUMERIC NOT NULL DEFAULT 80,
  combinable BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read tables" ON public.tables FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "manager write tables" ON public.tables FOR ALL
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));
CREATE INDEX idx_tables_restaurant ON public.tables(restaurant_id, zone_id);
CREATE TRIGGER trg_tables_updated BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TABLE COMBINATIONS ============
CREATE TABLE public.table_combinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  table_ids UUID[] NOT NULL,
  capacity_min INT NOT NULL,
  capacity_max INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.table_combinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read combos" ON public.table_combinations FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "manager write combos" ON public.table_combinations FOR ALL
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));
CREATE TRIGGER trg_combos_updated BEFORE UPDATE ON public.table_combinations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ GUESTS ============
CREATE TABLE public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  language TEXT NOT NULL DEFAULT 'nl',
  tags TEXT[] NOT NULL DEFAULT '{}',
  allergies TEXT,
  notes TEXT,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  is_blacklisted BOOLEAN NOT NULL DEFAULT false,
  total_visits INT NOT NULL DEFAULT 0,
  no_show_count INT NOT NULL DEFAULT 0,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read guests" ON public.guests FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "members write guests" ON public.guests FOR ALL
  USING (public.is_restaurant_member(restaurant_id))
  WITH CHECK (public.is_restaurant_member(restaurant_id));
CREATE INDEX idx_guests_restaurant_phone ON public.guests(restaurant_id, phone);
CREATE INDEX idx_guests_restaurant_email ON public.guests(restaurant_id, email);
CREATE TRIGGER trg_guests_updated BEFORE UPDATE ON public.guests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RESERVATIONS ============
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES public.guests(id) ON DELETE SET NULL,
  reservation_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  party_size INT NOT NULL CHECK (party_size > 0),
  status public.reservation_status NOT NULL DEFAULT 'pending',
  channel public.reservation_channel NOT NULL DEFAULT 'online',
  special_requests TEXT,
  dietary_notes TEXT,
  occasion TEXT,
  internal_notes TEXT,
  hold_expires_at TIMESTAMPTZ,
  confirmation_code TEXT UNIQUE,
  source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read reservations" ON public.reservations FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "members write reservations" ON public.reservations FOR ALL
  USING (public.is_restaurant_member(restaurant_id))
  WITH CHECK (public.is_restaurant_member(restaurant_id));
CREATE INDEX idx_res_restaurant_date ON public.reservations(restaurant_id, reservation_date);
CREATE INDEX idx_res_status ON public.reservations(restaurant_id, status);
CREATE INDEX idx_res_start ON public.reservations(restaurant_id, start_time);
CREATE TRIGGER trg_res_updated BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RESERVATION TABLES (assignment) ============
CREATE TABLE public.reservation_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, table_id)
);
ALTER TABLE public.reservation_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read rt" ON public.reservation_tables FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = reservation_id AND public.is_restaurant_member(r.restaurant_id))
);
CREATE POLICY "members write rt" ON public.reservation_tables FOR ALL USING (
  EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = reservation_id AND public.is_restaurant_member(r.restaurant_id))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = reservation_id AND public.is_restaurant_member(r.restaurant_id))
);
CREATE INDEX idx_rt_table ON public.reservation_tables(table_id);

-- ============ PRE-ORDERS ============
CREATE TABLE public.pre_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents INT NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pre_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read preorders" ON public.pre_orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = reservation_id AND public.is_restaurant_member(r.restaurant_id))
);
CREATE POLICY "members write preorders" ON public.pre_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = reservation_id AND public.is_restaurant_member(r.restaurant_id))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.reservations r WHERE r.id = reservation_id AND public.is_restaurant_member(r.restaurant_id))
);
CREATE TRIGGER trg_preorders_updated BEFORE UPDATE ON public.pre_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ LARGE GROUP REQUESTS ============
CREATE TABLE public.large_group_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  party_size INT NOT NULL,
  preferred_date DATE,
  preferred_time TIME,
  occasion TEXT,
  message TEXT,
  status public.large_group_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.large_group_requests ENABLE ROW LEVEL SECURITY;
-- Public can submit (form)
CREATE POLICY "public submit large group" ON public.large_group_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "members read large group" ON public.large_group_requests FOR SELECT USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "members update large group" ON public.large_group_requests FOR UPDATE USING (public.is_restaurant_member(restaurant_id));
CREATE POLICY "manager delete large group" ON public.large_group_requests FOR DELETE USING (public.is_restaurant_manager(restaurant_id));
CREATE TRIGGER trg_lgr_updated BEFORE UPDATE ON public.large_group_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ INTEGRATION EVENTS ============
CREATE TABLE public.integration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.integration_event_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  target TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager read events" ON public.integration_events FOR SELECT USING (public.is_restaurant_manager(restaurant_id));
CREATE POLICY "manager write events" ON public.integration_events FOR ALL
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));
CREATE INDEX idx_events_restaurant_status ON public.integration_events(restaurant_id, status);
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.integration_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ API TOKENS ============
CREATE TABLE public.api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager read tokens" ON public.api_tokens FOR SELECT USING (public.is_restaurant_manager(restaurant_id));
CREATE POLICY "manager write tokens" ON public.api_tokens FOR ALL
  USING (public.is_restaurant_manager(restaurant_id))
  WITH CHECK (public.is_restaurant_manager(restaurant_id));

-- ============ AUDIT LOG ============
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager read audit" ON public.audit_log FOR SELECT USING (public.is_restaurant_manager(restaurant_id));
CREATE POLICY "members insert audit" ON public.audit_log FOR INSERT WITH CHECK (public.is_restaurant_member(restaurant_id));
CREATE INDEX idx_audit_restaurant_created ON public.audit_log(restaurant_id, created_at DESC);
