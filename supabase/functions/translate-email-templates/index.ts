// Translates NL master copy for one email template to EN/DE/FR using Lovable AI Gateway.
// Triggered manually from the Messages settings page ("Vertaal met AI").
// Auth: relies on Supabase gateway verify_jwt = true; only authenticated members
// of the restaurant can write to restaurant_email_templates (RLS enforces this).
//
// Behavior:
// - Reads the NL row from restaurant_email_templates (or seeds it from defaultCopy.nl
//   if it doesn't yet exist).
// - Calls Gemini 2.5 Flash with a hospitality-tone system prompt.
// - Writes one row per target locale with is_ai_generated = true.
// - Refuses to overwrite a row that is_edited = true (manual restaurant override).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { LOCALES } from '../_shared/transactional-email-templates/i18n.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FIELDS = ['subject', 'heading', 'body_intro', 'body_outro', 'signature'] as const
type FieldKey = (typeof FIELDS)[number]

const LOCALE_LABEL: Record<string, string> = {
  en: 'English',
  de: 'German (Sie-form, polite)',
  fr: 'French (vouvoiement, polite)',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!lovableApiKey) {
    return new Response(JSON.stringify({ error: 'AI gateway not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let restaurantId: string
  let templateKey: string
  let targetLocales: string[]
  let overwriteEdited = false
  try {
    const body = await req.json()
    restaurantId = body.restaurantId
    templateKey = body.templateKey
    targetLocales = Array.isArray(body.targetLocales) && body.targetLocales.length > 0
      ? body.targetLocales
      : ['en', 'de', 'fr']
    overwriteEdited = !!body.overwriteEdited
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!restaurantId || !templateKey) {
    return new Response(JSON.stringify({ error: 'restaurantId and templateKey are required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const template = TEMPLATES[templateKey]
  if (!template || !template.defaultCopy) {
    return new Response(JSON.stringify({ error: `Unknown template '${templateKey}'` }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Use caller's JWT so RLS enforces manager role for writes
  const authHeader = req.headers.get('Authorization') || ''
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })

  // Fetch existing NL row (master); if missing, fall back to defaultCopy.nl
  const { data: nlRow } = await supabase
    .from('restaurant_email_templates')
    .select('subject, heading, body_intro, body_outro, signature')
    .eq('restaurant_id', restaurantId)
    .eq('template_key', templateKey)
    .eq('locale', 'nl')
    .maybeSingle()

  const nlDefault = template.defaultCopy.nl
  const master: Record<FieldKey, string> = {
    subject: nlRow?.subject || nlDefault.subject,
    heading: nlRow?.heading || nlDefault.heading,
    body_intro: nlRow?.body_intro || nlDefault.intro,
    body_outro: nlRow?.body_outro || nlDefault.outro,
    signature: nlRow?.signature || nlDefault.signature,
  }

  // Make sure NL master is persisted so restaurants can edit it later
  if (!nlRow) {
    await supabase
      .from('restaurant_email_templates')
      .upsert({
        restaurant_id: restaurantId, template_key: templateKey, locale: 'nl',
        ...master, is_ai_generated: false, is_edited: false,
      }, { onConflict: 'restaurant_id,template_key,locale' })
  }

  const results: Record<string, { status: string; reason?: string }> = {}

  for (const locale of targetLocales) {
    if (!(LOCALES as readonly string[]).includes(locale) || locale === 'nl') {
      results[locale] = { status: 'skipped', reason: 'invalid_locale' }
      continue
    }

    // Don't overwrite manually-edited copy unless explicitly requested
    const { data: existing } = await supabase
      .from('restaurant_email_templates')
      .select('is_edited')
      .eq('restaurant_id', restaurantId)
      .eq('template_key', templateKey)
      .eq('locale', locale)
      .maybeSingle()

    if (existing?.is_edited && !overwriteEdited) {
      results[locale] = { status: 'skipped', reason: 'manually_edited' }
      continue
    }

    const systemPrompt = `You translate restaurant guest emails. Keep them warm, gastvrij, hotel-style polite. Preserve {{placeholders}} EXACTLY as-is — do not translate them. Keep formatting (line breaks) the same. Output only the translation, no quotes, no commentary.`

    const userPrompt = `Translate the following Dutch restaurant email fields to ${LOCALE_LABEL[locale]}.
Return strict JSON with these keys: subject, heading, body_intro, body_outro, signature.
Preserve {{placeholders}} verbatim. Keep the tone friendly and inviting.

Dutch source:
${JSON.stringify(master, null, 2)}`

    let translated: Record<FieldKey, string> | null = null
    try {
      const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
        }),
      })

      if (!aiResp.ok) {
        const errText = await aiResp.text()
        console.error('AI gateway error', { locale, status: aiResp.status, errText })
        results[locale] = { status: 'failed', reason: `ai_error_${aiResp.status}` }
        continue
      }
      const aiJson = await aiResp.json()
      const content = aiJson?.choices?.[0]?.message?.content
      if (!content) {
        results[locale] = { status: 'failed', reason: 'empty_response' }
        continue
      }
      const parsed = JSON.parse(content)
      translated = {
        subject: String(parsed.subject || master.subject),
        heading: String(parsed.heading || master.heading),
        body_intro: String(parsed.body_intro || master.body_intro),
        body_outro: String(parsed.body_outro || master.body_outro),
        signature: String(parsed.signature || master.signature),
      }
    } catch (e) {
      console.error('Translation failed', { locale, error: String(e) })
      results[locale] = { status: 'failed', reason: 'exception' }
      continue
    }

    // Upsert translation row
    const { error: upErr } = await supabase
      .from('restaurant_email_templates')
      .upsert({
        restaurant_id: restaurantId,
        template_key: templateKey,
        locale,
        ...translated,
        is_ai_generated: true,
        is_edited: false,
      }, { onConflict: 'restaurant_id,template_key,locale' })

    if (upErr) {
      console.error('Upsert failed', { locale, upErr })
      results[locale] = { status: 'failed', reason: 'db_write_failed' }
    } else {
      results[locale] = { status: 'translated' }
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
