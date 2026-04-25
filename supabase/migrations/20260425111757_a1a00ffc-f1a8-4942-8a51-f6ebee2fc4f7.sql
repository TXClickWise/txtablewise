-- Extend review_request_status enum
ALTER TYPE review_request_status ADD VALUE IF NOT EXISTS 'ready_to_send';
ALTER TYPE review_request_status ADD VALUE IF NOT EXISTS 'positive';
ALTER TYPE review_request_status ADD VALUE IF NOT EXISTS 'neutral';
ALTER TYPE review_request_status ADD VALUE IF NOT EXISTS 'negative';
ALTER TYPE review_request_status ADD VALUE IF NOT EXISTS 'follow_up_required';
ALTER TYPE review_request_status ADD VALUE IF NOT EXISTS 'google_review_invited';

-- Extend review_requests with hospitality fields
ALTER TABLE public.review_requests
  ADD COLUMN IF NOT EXISTS feedback_type text,
  ADD COLUMN IF NOT EXISTS follow_up_status text,
  ADD COLUMN IF NOT EXISTS follow_up_owner_id uuid,
  ADD COLUMN IF NOT EXISTS follow_up_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_note text,
  ADD COLUMN IF NOT EXISTS public_review_url text,
  ADD COLUMN IF NOT EXISTS source_channel text,
  ADD COLUMN IF NOT EXISTS google_review_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_follow_up_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clickwise_workflow_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_requests_one_per_reservation
  ON public.review_requests(reservation_id);

-- Restaurant-level google review url for templates
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS google_review_url text,
  ADD COLUMN IF NOT EXISTS aftercare_enabled boolean NOT NULL DEFAULT true;