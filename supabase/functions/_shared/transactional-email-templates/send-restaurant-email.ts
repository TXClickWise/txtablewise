import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from './registry.ts'
import { mergeCopy, resolveLocale, interpolateCopy } from './i18n.ts'

// Server-only: reads LOVABLE_API_KEY and the service role key.
// Import from edge functions only — never expose sending to the browser.
//
// This helper carries TableWise's per-restaurant email composition
// (locale resolution, per-restaurant copy overrides, reply-to and from-name)
// which cannot be expressed through the plain template registry helper, and
// then sends directly through Lovable's managed email API.

const SITE_NAME = 'TX TableWise'
// Verified sender subdomain FQDN used for API lookup.
const SENDER_DOMAIN = 'notify.txtablewise.nl'
// Domain shown in the From: header.
const FROM_DOMAIN = 'notify.txtablewise.nl'

export interface SendRestaurantEmailInput {
  templateName: string
  recipientEmail?: string
  templateData?: Record<string, any>
  fromName?: string
  replyTo?: string
  restaurantId?: string
  locale?: string
  idempotencyKey?: string
}

export type SendRestaurantEmailResult =
  | { success: true; messageId: string }
  | { success: false; reason: 'email_suppressed' | 'template_not_found' | 'no_recipient' | 'send_failed'; error?: string }

function serviceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function sendRestaurantEmail(
  input: SendRestaurantEmailInput,
): Promise<SendRestaurantEmailResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured')
  }

  const templateName = input.templateName
  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('Template not found in registry', { templateName })
    return { success: false, reason: 'template_not_found' }
  }

  const effectiveRecipient = template.to || input.recipientEmail
  if (!effectiveRecipient) {
    return { success: false, reason: 'no_recipient' }
  }

  const messageId = crypto.randomUUID()
  const idempotencyKey = input.idempotencyKey || messageId
  const templateData = input.templateData ?? {}
  const supabase = serviceClient()

  // Resolve locale + copy (multi-language support).
  let restaurantDefaultLocale: string | undefined
  let restaurantName: string | undefined
  let restaurantReplyTo: string | undefined
  if (input.restaurantId) {
    const { data: r } = await supabase
      .from('restaurants')
      .select('default_locale, name, guest_reply_to_email')
      .eq('id', input.restaurantId)
      .maybeSingle()
    restaurantDefaultLocale = r?.default_locale
    restaurantName = r?.name
    restaurantReplyTo = typeof r?.guest_reply_to_email === 'string'
      ? r.guest_reply_to_email.trim()
      : undefined
  }
  const locale = resolveLocale(input.locale, restaurantDefaultLocale)

  // Per-restaurant DB copy override for this template_key + locale.
  let dbRow: any = null
  if (input.restaurantId && template.templateKey) {
    const { data } = await supabase
      .from('restaurant_email_templates')
      .select('subject, heading, body_intro, body_outro, signature')
      .eq('restaurant_id', input.restaurantId)
      .eq('template_key', template.templateKey)
      .eq('locale', locale)
      .maybeSingle()
    if (data) {
      dbRow = {
        subject: data.subject,
        heading: data.heading,
        intro: data.body_intro,
        outro: data.body_outro,
        signature: data.signature,
      }
    }
  }

  const defaultCopy = template.defaultCopy
  const baseCopy = defaultCopy ? mergeCopy(defaultCopy, locale as any, dbRow) : null

  const interpolationVars = {
    restaurantName: restaurantName || templateData.restaurantName || 'het restaurant',
    guestName: templateData.guestName || '',
    dateLabel: templateData.dateLabel || '',
    timeLabel: templateData.timeLabel || '',
    partySize: templateData.partySize || '',
  }

  const finalCopy = baseCopy ? interpolateCopy(baseCopy, interpolationVars) : null

  const renderProps = {
    ...templateData,
    ...interpolationVars,
    copy: finalCopy,
    locale,
  }

  const element = React.createElement(template.component, renderProps)
  const html = await renderAsync(element)
  const text = await renderAsync(element, { plainText: true })

  const subject = finalCopy?.subject ||
    (typeof template.subject === 'function'
      ? template.subject(renderProps)
      : template.subject)

  // Sanitize From-name to avoid header injection / RFC 5322 issues
  const safeFromName = (input.fromName || SITE_NAME)
    .replace(/[\r\n"<>]/g, '')
    .trim()
    .slice(0, 80) || SITE_NAME

  const sanitizedReplyTo = (restaurantReplyTo || input.replyTo || '')
    .replace(/[\r\n]/g, '')
    .trim()
  const effectiveReplyTo = /^\S+@\S+\.\S+$/.test(sanitizedReplyTo)
    ? sanitizedReplyTo
    : undefined

  try {
    await sendLovableEmail(
      {
        to: effectiveRecipient,
        from: `${safeFromName} <noreply@${FROM_DOMAIN}>`,
        reply_to: effectiveReplyTo,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: 'transactional',
        label: templateName,
        idempotency_key: idempotencyKey,
        message_id: messageId,
      },
      { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') },
    )
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      const { error: logError } = await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'suppressed',
      })
      if (logError) {
        console.error('Failed to write suppressed send log', {
          code: logError.code,
          message: logError.message,
        })
      }
      return { success: false, reason: 'email_suppressed' }
    }

    const errorMsg = error instanceof Error ? error.message : String(error)
    const { error: logError } = await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: errorMsg.slice(0, 1000),
    })
    if (logError) {
      console.error('Failed to write failed send log', {
        code: logError.code,
        message: logError.message,
      })
    }
    console.error('Email send failed', { templateName, error: errorMsg })
    return { success: false, reason: 'send_failed', error: errorMsg }
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'sent',
  })
  if (logError) {
    console.error('Failed to write sent send log', {
      code: logError.code,
      message: logError.message,
    })
  }

  return { success: true, messageId }
}
