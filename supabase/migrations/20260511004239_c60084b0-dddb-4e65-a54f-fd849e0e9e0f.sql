ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS pos_preorder_pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pos_preorder_receipt_id text,
  ADD COLUMN IF NOT EXISTS pos_preorder_status text;

CREATE INDEX IF NOT EXISTS reservations_preorder_push_idx
  ON public.reservations (restaurant_id, start_time)
  WHERE pos_preorder_pushed_at IS NULL;