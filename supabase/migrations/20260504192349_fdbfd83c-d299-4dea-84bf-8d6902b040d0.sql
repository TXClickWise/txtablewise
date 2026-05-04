CREATE OR REPLACE FUNCTION public.check_table_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_status text;
  v_hold_expires timestamptz;
  v_conflict_count int;
BEGIN
  SELECT r.start_time, r.end_time, r.status::text, r.hold_expires_at
    INTO v_start, v_end, v_status, v_hold_expires
    FROM public.reservations r
    WHERE r.id = NEW.reservation_id;

  IF v_status IN ('cancelled', 'no_show', 'completed', 'finished') THEN
    RETURN NEW;
  END IF;
  IF v_status = 'hold' AND (v_hold_expires IS NULL OR v_hold_expires <= now()) THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_conflict_count
    FROM public.reservation_tables rt
    JOIN public.reservations r ON r.id = rt.reservation_id
    WHERE rt.table_id = NEW.table_id
      AND rt.reservation_id <> NEW.reservation_id
      AND r.status::text NOT IN ('cancelled', 'no_show', 'completed', 'finished')
      AND NOT (r.status::text = 'hold' AND (r.hold_expires_at IS NULL OR r.hold_expires_at <= now()))
      AND r.start_time < v_end
      AND r.end_time > v_start;

  IF v_conflict_count > 0 THEN
    RAISE EXCEPTION 'Tafel is al geboekt in dit tijdvenster (table_id: %, reservation_id: %)',
      NEW.table_id, NEW.reservation_id
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_table_booking_overlap ON public.reservation_tables;
CREATE TRIGGER trg_check_table_booking_overlap
  BEFORE INSERT ON public.reservation_tables
  FOR EACH ROW
  EXECUTE FUNCTION public.check_table_booking_overlap();