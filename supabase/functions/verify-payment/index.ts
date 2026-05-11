import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Monthly subscription price in USD. */
const MONTHLY_SUBSCRIPTION_USD = 8
/** Subscription period in days granted after payment. */
const SUBSCRIPTION_DAYS = 30
/**
 * Underpayment tolerance factor (0.95 = 5%).
 * Accounts for BTC network fees and minor exchange rate fluctuations
 * between when the amount was displayed and when payment arrived.
 */
const PAYMENT_TOLERANCE = 0.95

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

    const { data: meta } = await supabase
      .from('users_meta')
      .select('btc_address, is_paid')
      .eq('id', user_id)
      .single()

    if (!meta?.btc_address) {
      return new Response(JSON.stringify({ confirmed: false, reason: 'no_address' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (meta.is_paid) {
      return new Response(JSON.stringify({ confirmed: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check Blockonomics for received balance
    const apiKey = Deno.env.get('BLOCKONOMICS_API_KEY')
    if (!apiKey) throw new Error('BLOCKONOMICS_API_KEY not configured')
    const balRes = await fetch(
      `https://www.blockonomics.co/api/balance?addr=${meta.btc_address}`,
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    )

    if (!balRes.ok) {
      throw new Error(`Blockonomics balance check failed: ${balRes.statusText}`)
    }

    const balData = await balRes.json()
    // Blockonomics returns balance in satoshis
    const satoshis = balData.response?.[0]?.confirmed ?? 0

    // Get pending payment to check expected amount
    const { data: payment } = await supabase
      .from('payments')
      .select('amount_expected')
      .eq('user_id', user_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Fetch current BTC price to validate amount
    const priceRes = await fetch('https://www.blockonomics.co/api/price?currency=USD')
    if (!priceRes.ok) {
      throw new Error(`Blockonomics price fetch failed: ${priceRes.statusText}`)
    }
    const priceData = await priceRes.json()
    const btcPriceUSD = priceData.price as number

    const amountExpectedUSD = payment?.amount_expected ?? MONTHLY_SUBSCRIPTION_USD
    const expectedSatoshis = Math.floor((amountExpectedUSD / btcPriceUSD) * 1e8 * PAYMENT_TOLERANCE)

    const confirmed = satoshis >= expectedSatoshis

    if (confirmed) {
      const paidUntil = new Date()
      paidUntil.setDate(paidUntil.getDate() + SUBSCRIPTION_DAYS)

      await supabase
        .from('users_meta')
        .update({ is_paid: true, paid_until: paidUntil.toISOString() })
        .eq('id', user_id)

      await supabase
        .from('payments')
        .update({ status: 'confirmed' })
        .eq('user_id', user_id)
        .eq('btc_address', meta.btc_address)
    }

    return new Response(JSON.stringify({ confirmed, satoshis, expectedSatoshis }), {
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
