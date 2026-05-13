## Goal
Verify the email setup end-to-end by sending test emails to `jeroen@clickwise.app`.

## Issue found during check
The verified Lovable email domain is **`notify.txtablewise.nl`**, but `supabase/functions/send-transactional-email/index.ts` has:
```
SENDER_DOMAIN = "notify.reservations.txtablewise.nl"
FROM_DOMAIN   = "notify.reservations.txtablewise.nl"
```
This mismatch makes every transactional send fail with "No email domain record found". This must be fixed first, otherwise the test will only confirm a broken state.

## Steps

1. **Fix sender domain**
   - In `supabase/functions/send-transactional-email/index.ts` set:
     - `SENDER_DOMAIN = "notify.txtablewise.nl"`
     - `FROM_DOMAIN = "notify.txtablewise.nl"` (or `txtablewise.nl` if root From is preferred — I'll use the verified subdomain to stay safe)
   - Redeploy `send-transactional-email`.

2. **Send test #1 — transactional template**
   - Invoke `send-transactional-email` with template `reservation-confirmation`, recipient `jeroen@clickwise.app`, sample reservation data (guest name, date, time, party size, restaurant name, manage/cancel/confirm/review URLs pointed at the live site).

3. **Send test #2 — second template** (optional, to validate another path)
   - Same as above but with `reservation-reminder` so we exercise a different template.

4. **Verify delivery**
   - Query `email_send_log` (deduplicated by `message_id`) for both `message_id`s and report status (`pending` → `sent`, or `failed`/`dlq` with the error).
   - Check `process-email-queue` logs if anything stays `pending`.

5. **Report**
   - Tell user: domain status, fix applied, send results, and whether the inbox should receive both emails.

## Notes
- Auth is fine: `send-transactional-email` runs with `verify_jwt = true`; calling it from the server with the service role works.
- No DB schema changes.
- No UI changes.
