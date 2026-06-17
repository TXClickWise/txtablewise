CREATE OR REPLACE FUNCTION public.notify_reservation_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _service_key text;
  _url text := 'https://lbhtztbpxmqlzhyephew.supabase.co/functions/v1/send_reservation_email';
  _reservation_id text;
BEGIN
  IF NEW.event_type NOT IN (
    'reservation.confirmed',
    'reservation.cancelled',
    'reservation.reminder_24h',
    'reservation.reminder_2h',
    'reservation.completed',
    'reservation.reconfirmation_requested',
    'reservation.large_group_approved',
    'reservation.large_group_declined'
  ) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets
    WHERE name = 'email_queue_service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    _service_key := NULL;
  END;

  IF _service_key IS NULL THEN
    RAISE WARNING 'notify_reservation_email: vault secret email_queue_service_role_key not found, skipping HTTP dispatch';
    RETURN NEW;
  END IF;

  _reservation_id := COALESCE(
    NEW.payload->>'reservation_id',
    CASE WHEN NEW.entity_type = 'reservation' THEN NEW.entity_id::text END
  );

  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := jsonb_build_object(
      'event_id', NEW.id,
      'event_type', NEW.event_type,
      'reservation_id', _reservation_id,
      'restaurant_id', NEW.restaurant_id
    )
  );

  RETURN NEW;
END;
$function$;