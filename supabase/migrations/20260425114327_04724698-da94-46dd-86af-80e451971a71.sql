-- Extend pos_provider enum with new providers
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'loyverse_demo';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'manual_demo';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'manual';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'csv_import';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'webhook';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'vectron';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'booq';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'twelve';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'mpluskassa';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'eijsink';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'winston';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'tebi';
ALTER TYPE public.pos_provider ADD VALUE IF NOT EXISTS 'custom_api';

-- Extend pos_orders with matching & source metadata
ALTER TABLE public.pos_orders
  ADD COLUMN IF NOT EXISTS matching_status TEXT NOT NULL DEFAULT 'unmatched',
  ADD COLUMN IF NOT EXISTS match_score TEXT,
  ADD COLUMN IF NOT EXISTS matched_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual_demo',
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'manual_demo',
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS receipt_created_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS guest_id UUID,
  ADD COLUMN IF NOT EXISTS external_table_id TEXT,
  ADD COLUMN IF NOT EXISTS sync_status TEXT,
  ADD COLUMN IF NOT EXISTS sync_error TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tax_total_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_total_cents INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pos_orders_restaurant_match ON public.pos_orders(restaurant_id, matching_status);
CREATE INDEX IF NOT EXISTS idx_pos_orders_reservation ON public.pos_orders(reservation_id);

-- Pre-order item POS mapping (light, optional)
ALTER TABLE public.pre_order_items
  ADD COLUMN IF NOT EXISTS pos_provider TEXT,
  ADD COLUMN IF NOT EXISTS external_product_id TEXT;