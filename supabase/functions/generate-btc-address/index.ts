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
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if address already exists
    const { data: existing } = await supabase
      .from('users_meta')
      .select('btc_address')
      .eq('id', user_id)
      .single()

    if (existing?.btc_address) {
      return new Response(JSON.stringify({ btc_address: existing.btc_address }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate new BTC address via Blockonomics
    const apiKey = Deno.env.get('BLOCKONOMICS_API_KEY')
    if (!apiKey) throw new Error('BLOCKONOMICS_API_KEY not configured')
    const btcRes = await fetch('https://www.blockonomics.co/api/new_address', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!btcRes.ok) {
      throw new Error(`Blockonomics error: ${btcRes.statusText}`)
    }

    const btcData = await btcRes.json()
    const btcAddress = btcData.address

    // Store address in users_meta
    await supabase
      .from('users_meta')
      .update({ btc_address: btcAddress })
      .eq('id', user_id)

    // Create pending payment record
    await supabase.from('payments').insert({
      user_id,
      btc_address: btcAddress,
      amount_expected: 8,
      status: 'pending',
    })

    return new Response(JSON.stringify({ btc_address: btcAddress }), {
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
