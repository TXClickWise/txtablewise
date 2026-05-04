# Reminder Scheduler — Cron Setup

De `reminder_scheduler` edge function moet periodiek draaien om automatisch
herinneringsevents aan te maken voor reserveringen die over 24 uur of 2 uur
starten. Dit is een **handmatige eenmalige setup** per omgeving.

## Optie 1 — Supabase pg_cron (aanbevolen)

In de Supabase SQL Editor:

```sql
-- Activeer extensies (eenmalig)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule: elke 15 minuten
SELECT cron.schedule(
  'tablewise-reminder-scheduler',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lbhtztbpxmqlzhyephew.supabase.co/functions/v1/reminder_scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Vervang `<SERVICE_ROLE_KEY>` door de service-role key van het project.

### Cron uitschakelen

```sql
SELECT cron.unschedule('tablewise-reminder-scheduler');
```

## Optie 2 — Externe cron (cron-job.org, GitHub Actions, etc.)

Stel een HTTP POST in naar:

```
POST https://lbhtztbpxmqlzhyephew.supabase.co/functions/v1/reminder_scheduler
Content-Type: application/json
Authorization: Bearer <SERVICE_ROLE_KEY>

{}
```

Schedule: **elke 15 minuten**.

## Wat de scheduler doet

1. Zoekt reserveringen die over 22–26 uur starten → maakt `reminder_24h` events
2. Zoekt reserveringen die over 1,5–2,5 uur starten → maakt `reminder_2h` events
3. Deduplicatie: maakt geen dubbele events aan
4. Geen externe API-calls — alleen `integration_events` aanmaken; ClickWise
   verwerkt deze events vervolgens via `clickwise_process_event`.

## Verificatie

- Roep de functie handmatig aan en controleer in `integration_events` dat er
  rijen zijn aangemaakt met `event_type = 'reminder_24h'` of `'reminder_2h'`.
- Bekijk `cron.job_run_details` om scheduler-runs te inspecteren.
