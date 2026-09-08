import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type SuppressionReason = 'bounce' | 'complaint' | 'unsubscribe'
type SendLogStatus = 'bounced' | 'complained' | 'suppressed'

const REASON_MESSAGE: Record<SuppressionReason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

async function record(
  event: { event_id: string; data: Record<string, any> },
  reason: SuppressionReason,
  status: SendLogStatus,
) {
  const recipient = String(event.data?.recipient ?? '').toLowerCase()
  if (!recipient) {
    console.error('Email event without recipient', { event_id: event.event_id })
    return
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert({ email: recipient, reason, metadata: null }, { onConflict: 'email' })

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      code: suppressError.code,
      message: suppressError.message,
      event_id: event.event_id,
    })
    throw new Error('Failed to write suppression')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: event.data?.message_id ?? null,
    template_name: 'system',
    recipient_email: recipient,
    status,
    error_message: REASON_MESSAGE[reason],
    metadata: null,
  })

  if (logError) {
    console.error('Failed to insert email_send_log', {
      code: logError.code,
      message: logError.message,
      event_id: event.event_id,
    })
    throw new Error('Failed to write email send log')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await record(event as any, 'bounce', 'bounced')
    },
    'email.complaint': async (event) => {
      await record(event as any, 'complaint', 'complained')
    },
    'email.unsubscribed': async (event) => {
      await record(event as any, 'unsubscribe', 'suppressed')
    },
  },
})

Deno.serve((req) => handler(req))
