// send_reservation_email
//
// Triggered by an INSERT in public.integration_events (via DB trigger using pg_net).
// - Skips when restaurant has ClickWise live mode enabled (avoids duplicate messages).
// - Skips when guest has no real email address.
// - Skips when the per-restaurant notification setting for this event is off.
// - Maps event_type → transactional template name and forwards to send-transactional-email.
//
// Logs every decision to integration_logs.

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// event_type → { templateName, settingKey }
const EVENT_MAP: Record<string, { template: string; settingKey: string }> = {
  'reservation.confirmed': { template: 'reservation-confirmation', settingKey: 'reservation_confirmed' },
  'reservation.cancelled': { template: 'reservation-cancellation', settingKey: 'reservation_cancelled' },
  'reservation.reminder_24h': { template: 'reservation-reminder', settingKey: 'reminder_24h' },
  'reservation.reminder_2h': { template: 'reservation-reminder', settingKey: 'reminder_2h' },
  'reservation.completed': { template: 'reservation-thankyou', settingKey: 'reservation_completed' },
  'reservation.reconfirmation_requested': { template: 'reservation-reconfirm', settingKey: 'reconfirmation_requested' },
}

function isSyntheticEmail(email: string | null | undefined): boolean {
  if (!email) return true
  return /@tablewise\.local$/i.test(email)
}

async function logResult(
  sb: any,
  restaurantId: string,
  eventId: string | null,
  status: string,
  detail: Record<string, any>,
  reservationId?: string | null,
) {
  try {
    await sb.from('integration_logs').insert({
      restaurant_id: restaurantId,
      source: 'email',
      action: detail.event_type || 'send_reservation_email',
      status,
      reservation_id: reservationId || null,
      request_payload: { event_id: eventId, ...detail },
    })
  } catch (e) {
    console.error('Failed to write integration_logs', e)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb = createClient(supabaseUrl, serviceKey)

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { event_id, event_type, reservation_id, restaurant_id } = body || {}

  if (!event_type || !restaurant_id) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const mapping = EVENT_MAP[event_type]
  if (!mapping) {
    return new Response(JSON.stringify({ status: 'ignored', reason: 'unmapped_event' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!reservation_id) {
    await logResult(sb, restaurant_id, event_id, 'skipped_no_reservation_id', { event_type })
    return new Response(JSON.stringify({ status: 'skipped', reason: 'no_reservation_id' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Load restaurant + ClickWise + reservation + guest
  const [{ data: restaurant }, { data: cw }, { data: reservation }] = await Promise.all([
    sb.from('restaurants').select('id, name, locale, default_locale, email_notification_settings, slug, guest_reply_to_email').eq('id', restaurant_id).maybeSingle(),
    sb.from('clickwise_settings').select('connection_mode').eq('restaurant_id', restaurant_id).maybeSingle(),
    sb.from('reservations').select('id, restaurant_id, guest_id, reservation_date, start_time, party_size, manage_token, cancel_token').eq('id', reservation_id).maybeSingle(),
  ])

  if (!restaurant) {
    await logResult(sb, restaurant_id, event_id, 'skipped_restaurant_not_found', { event_type })
    return new Response(JSON.stringify({ status: 'skipped' }), { status: 200, headers: corsHeaders })
  }
  if (!reservation) {
    await logResult(sb, restaurant_id, event_id, 'skipped_reservation_not_found', { event_type, reservation_id })
    return new Response(JSON.stringify({ status: 'skipped' }), { status: 200, headers: corsHeaders })
  }

  // ClickWise live → skip (ClickWise handles communication)
  if (cw?.connection_mode === 'live') {
    await logResult(sb, restaurant_id, event_id, 'skipped_clickwise_active', { event_type, reservation_id })
    return new Response(JSON.stringify({ status: 'skipped', reason: 'clickwise_active' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Per-restaurant notification toggle
  const settings = (restaurant.email_notification_settings || {}) as Record<string, boolean>
  if (settings[mapping.settingKey] === false) {
    await logResult(sb, restaurant_id, event_id, 'skipped_disabled_by_setting', { event_type, settingKey: mapping.settingKey })
    return new Response(JSON.stringify({ status: 'skipped', reason: 'disabled' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Load guest
  if (!reservation.guest_id) {
    await logResult(sb, restaurant_id, event_id, 'skipped_no_guest', { event_type, reservation_id })
    return new Response(JSON.stringify({ status: 'skipped' }), { status: 200, headers: corsHeaders })
  }
  const { data: guest } = await sb.from('guests').select('id, first_name, last_name, full_name, email, language').eq('id', reservation.guest_id).maybeSingle()

  if (!guest || isSyntheticEmail(guest.email)) {
    await logResult(sb, restaurant_id, event_id, 'skipped_no_email', { event_type, reservation_id })
    return new Response(JSON.stringify({ status: 'skipped', reason: 'no_email' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Format date/time labels in restaurant timezone-friendly Dutch
  const locale = guest.language || restaurant.default_locale || restaurant.locale || 'nl'
  const startDate = new Date(reservation.start_time)
  const dateLabel = startDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeLabel = startDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const guestName = guest.first_name || guest.full_name?.split(' ')[0] || ''

  // Build manage / confirm / cancel URLs
  const baseUrl = (Deno.env.get('SITE_URL') || 'https://www.txtablewise.nl').replace(/\/+$/, '')
  const slugPart = restaurant.slug ? `/${restaurant.slug}` : ''
  const manageUrl = `${baseUrl}/r${slugPart}/manage/${reservation.manage_token}`
  const cancelUrl = `${baseUrl}/r${slugPart}/manage/${reservation.cancel_token}?action=cancel`
  const confirmUrl = `${baseUrl}/r${slugPart}/manage/${reservation.manage_token}?action=reconfirm`
  const reviewUrl = `${baseUrl}/r${slugPart}/manage/${reservation.manage_token}?action=review`

  const templateData: Record<string, any> = {
    guestName,
    dateLabel,
    timeLabel,
    partySize: reservation.party_size,
    restaurantName: restaurant.name,
    manageUrl,
    cancelUrl,
    confirmUrl,
    reviewUrl,
  }

  // Forward to generic transactional sender (handles rendering, suppression, queue, retries)
  const { data: sendRes, error: sendErr } = await sb.functions.invoke('send-transactional-email', {
    body: {
      templateName: mapping.template,
      recipientEmail: guest.email,
      idempotencyKey: `${event_type}:${reservation.id}:${event_id || crypto.randomUUID()}`,
      restaurantId: restaurant_id,
      locale,
      fromName: restaurant.name,
      replyTo: restaurant.guest_reply_to_email || undefined,
      templateData,
    },
  })

  if (sendErr) {
    await logResult(sb, restaurant_id, event_id, 'send_failed', {
      event_type, template: mapping.template, error: String(sendErr?.message || sendErr),
    })
    return new Response(JSON.stringify({ status: 'error', error: sendErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await logResult(sb, restaurant_id, event_id, 'sent', {
    event_type, template: mapping.template, recipient: guest.email, result: sendRes,
  })

  return new Response(JSON.stringify({ status: 'sent', template: mapping.template }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
