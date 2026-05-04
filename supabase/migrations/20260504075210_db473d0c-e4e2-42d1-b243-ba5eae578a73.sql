UPDATE public.reservations SET status = 'completed' WHERE status::text = 'finished';
UPDATE public.reservation_status_history SET new_status = 'completed' WHERE new_status = 'finished';
UPDATE public.reservation_status_history SET old_status = 'completed' WHERE old_status = 'finished';