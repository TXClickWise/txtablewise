-- Add settings columns to restaurants for onboarding wizard (Prompt 03)
-- All additive, no renames, no destructive changes.

ALTER TABLE public.restaurants
  -- General
  ADD COLUMN IF NOT EXISTS website text,
  -- Reservation rules
  ADD COLUMN IF NOT EXISTS auto_confirm boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS manual_approval_from_party_size integer,
  ADD COLUMN IF NOT EXISTS allow_zone_preference boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_guest_notes boolean NOT NULL DEFAULT true,
  -- Walk-in settings
  ADD COLUMN IF NOT EXISTS walkins_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS walkin_default_minutes integer NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS walkin_default_zone_id uuid,
  ADD COLUMN IF NOT EXISTS walkin_quick_buttons boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS walkin_ai_quick_seat boolean NOT NULL DEFAULT true,
  -- Large group settings
  ADD COLUMN IF NOT EXISTS large_group_extra_minutes integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS large_group_manual_approval_from integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS large_group_deposit_recommended_from integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS large_group_auto_book_max integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS large_group_default_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS large_group_confirmation_text text,
  ADD COLUMN IF NOT EXISTS large_group_cancellation_terms text,
  -- No-show prevention
  ADD COLUMN IF NOT EXISTS noshow_confirmation_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS noshow_reminder_24h_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS noshow_reminder_2h_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS noshow_reconfirm_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS noshow_guest_cancel_link_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS noshow_deposit_rules_prepared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS noshow_exempt_regulars_prepared boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS noshow_cancel_message text,
  -- Waitlist settings
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS waitlist_auto_offer_on_full boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS waitlist_allow_preferred_times boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS waitlist_clickwise_message_prepared boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS waitlist_response_window_minutes integer NOT NULL DEFAULT 15,
  -- Pre-orders settings
  ADD COLUMN IF NOT EXISTS preorders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preorders_payment_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preorders_allow_free_text boolean NOT NULL DEFAULT true;
