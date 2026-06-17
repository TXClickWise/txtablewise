-- 1a) Approve Widget04Huge (15p)
UPDATE public.reservations
SET status='confirmed', requires_manual_approval=false, large_group_status='approved', updated_at=now()
WHERE id='a8cb022a-0fcc-4073-9c62-429eac553d87' AND status='pending';

INSERT INTO public.integration_events (restaurant_id, event_type, target, entity_type, entity_id, payload)
SELECT restaurant_id, 'reservation.large_group_approved', 'clickwise', 'reservation', id,
  jsonb_build_object('reservation_id', id, 'party_size', party_size, 'start_time', start_time)
FROM public.reservations WHERE id='a8cb022a-0fcc-4073-9c62-429eac553d87';

-- 1b) Decline lg12 (12p)
UPDATE public.reservations
SET status='cancelled', cancelled_at=now(),
    cancellation_reason='Testdraai: helaas geen plaats beschikbaar voor zo''n grote groep op deze datum.',
    large_group_status='declined', requires_manual_approval=false, updated_at=now()
WHERE id='fd232aa9-6c3e-4106-bea0-fc08a61a6906' AND status='pending';

INSERT INTO public.integration_events (restaurant_id, event_type, target, entity_type, entity_id, payload)
SELECT restaurant_id, 'reservation.large_group_declined', 'clickwise', 'reservation', id,
  jsonb_build_object('reservation_id', id, 'party_size', party_size, 'start_time', start_time,
                     'reason', 'Testdraai: helaas geen plaats beschikbaar voor zo''n grote groep op deze datum.')
FROM public.reservations WHERE id='fd232aa9-6c3e-4106-bea0-fc08a61a6906';

-- 3) Backfill review_requests voor reeds completed testreserveringen
INSERT INTO public.review_requests (restaurant_id, reservation_id, guest_id, status, scheduled_for, source_channel)
SELECT r.restaurant_id, r.id, r.guest_id, 'ready_to_send'::review_request_status,
       now() + interval '14 hours', r.channel::text
FROM public.reservations r
WHERE r.id IN ('506cf641-2e09-4902-a5a0-cd47c2332a11','ef8ba909-8d8b-4c40-8d87-e3b9ad61bc99')
  AND NOT EXISTS (SELECT 1 FROM public.review_requests rr WHERE rr.reservation_id=r.id);

INSERT INTO public.integration_events (restaurant_id, event_type, target, entity_type, entity_id, payload)
SELECT r.restaurant_id, 'review.requested', 'clickwise', 'reservation', r.id,
       jsonb_build_object('reservation_id', r.id, 'guest_id', r.guest_id, 'backfill', true)
FROM public.reservations r
WHERE r.id IN ('506cf641-2e09-4902-a5a0-cd47c2332a11','ef8ba909-8d8b-4c40-8d87-e3b9ad61bc99');