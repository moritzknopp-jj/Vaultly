import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data, error } = await supabase
      .from('users_meta')
      .select('trial_start, is_paid, paid_until')
      .eq('id', user_id)
      .single()

    if (error || !data) {
      return new Response(JSON.stringify({ active: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const trialEnd = new Date(data.trial_start)
    trialEnd.setDate(trialEnd.getDate() + 30)

    const inTrial = now < trialEnd
    const isPaid = data.is_paid && data.paid_until && new Date(data.paid_until) > now
    const active = inTrial || isPaid

    return new Response(JSON.stringify({ active, inTrial, isPaid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
