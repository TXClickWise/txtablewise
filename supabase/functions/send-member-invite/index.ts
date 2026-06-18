import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function appBaseUrl(req: Request): string {
  const origin = req.headers.get('origin') || req.headers.get('referer')
  if (origin) {
    try { return new URL(origin).origin } catch { /* fall through */ }
  }
  return 'https://txtablewise.nl'
}

function formatDate(d: string | null | undefined): string | undefined {
  if (!d) return undefined
  try {
    return new Date(d).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return undefined }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const callerId = userData.user.id

  let invitationId: string
  try {
    const body = await req.json()
    invitationId = String(body.invitationId || body.invitation_id || '')
    if (!invitationId) throw new Error('invitationId required')
  } catch {
    return new Response(JSON.stringify({ error: 'invitationId required' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: inv, error: invErr } = await admin
    .from('member_invitations')
    .select('id, restaurant_id, email, role, token, expires_at, status, invited_by')
    .eq('id', invitationId)
    .maybeSingle()
  if (invErr || !inv) {
    return new Response(JSON.stringify({ error: 'Invitation not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (inv.status !== 'pending') {
    return new Response(JSON.stringify({ error: 'Invitation is not pending' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Authorize caller via security-definer helpers evaluated as the caller.
  const { data: isMgrAsCaller } = await userClient.rpc('is_restaurant_manager', { _restaurant_id: inv.restaurant_id })
  const { data: isAdmin } = await userClient.rpc('is_system_admin')
  if (!isMgrAsCaller && !isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('name')
    .eq('id', inv.restaurant_id)
    .maybeSingle()
  const { data: inviterProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('user_id', inv.invited_by || callerId)
    .maybeSingle()

  const base = appBaseUrl(req)
  const inviteUrl = `${base}/invite?token=${inv.token}`

  const { error: sendErr } = await admin.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'member-invitation',
      recipientEmail: inv.email,
      idempotencyKey: `member-invite-${inv.id}-${inv.token}`,
      restaurantId: inv.restaurant_id,
      templateData: {
        restaurantName: restaurant?.name || 'het restaurant',
        role: inv.role,
        inviterName: inviterProfile?.display_name || undefined,
        inviteUrl,
        expiresAtLabel: formatDate(inv.expires_at),
      },
    },
  })

  if (sendErr) {
    console.error('send-member-invite: email send failed', sendErr)
    return new Response(JSON.stringify({ error: 'Failed to send email' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
