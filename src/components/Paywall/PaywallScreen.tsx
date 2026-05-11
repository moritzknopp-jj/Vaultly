import { useState, useEffect, useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import Logo from '../Logo'
import styles from './Paywall.module.css'

const FALLBACK_BTC_AMOUNT = '0.000120'

interface Props {
  userId: string
  btcAddress: string | null
  onPaymentConfirmed: () => void
  onSignOut: () => void
}

export default function PaywallScreen({ userId, btcAddress, onPaymentConfirmed, onSignOut }: Props) {
  const [btcAmount, setBtcAmount] = useState<string | null>(null)
  const [btcPrice, setBtcPrice] = useState<number | null>(null)
  const [status, setStatus] = useState<'waiting' | 'confirmed'>('waiting')
  const [address, setAddress] = useState(btcAddress)
  const [copyFeedback, setCopyFeedback] = useState(false)

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch('https://www.blockonomics.co/api/price?currency=USD')
        if (res.ok) {
          const data = await res.json()
          const price = data.price as number
          setBtcPrice(price)
          setBtcAmount((8 / price).toFixed(6))
        }
      } catch {
        setBtcAmount(FALLBACK_BTC_AMOUNT)
      }
    }
    fetchPrice()
  }, [])

  useEffect(() => {
    if (address) return
    supabase.functions.invoke('generate-btc-address', { body: { user_id: userId } })
      .then(({ data }) => {
        if (data?.btc_address) setAddress(data.btc_address)
      })
      .catch(console.warn)
  }, [address, userId])

  const checkPayment = useCallback(async () => {
    const { data } = await supabase.functions.invoke('verify-payment', { body: { user_id: userId } })
    if (data?.confirmed) {
      setStatus('confirmed')
      setTimeout(onPaymentConfirmed, 2500)
    }
  }, [userId, onPaymentConfirmed])

  useEffect(() => {
    checkPayment()
    const interval = setInterval(checkPayment, 30000)
    return () => clearInterval(interval)
  }, [checkPayment])

  async function copyAddress() {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    } catch { /* ignore */ }
  }

  const paymentUri = address && btcAmount ? `bitcoin:${address}?amount=${btcAmount}` : address ?? ''

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <Logo size={32} />
          <h1 className={styles.appName}>Vaultly</h1>
        </div>

        {status === 'confirmed' ? (
          <div className={styles.successState}>
            <div className={styles.successIconWrap}>✅</div>
            <h2 className={styles.successTitle}>Payment received!</h2>
            <p className={styles.successSubtitle}>Unlocking your vault access…</p>
            <div className={styles.successSpinner} />
          </div>
        ) : (
          <>
            <div className={styles.headingBlock}>
              <h2 className={styles.heading}>Your trial has ended</h2>
              <p className={styles.subheading}>
                Continue with full access for <span className={styles.price}>$8 / month</span>,
                paid privately in Bitcoin.
              </p>
            </div>

            {address ? (
              <div className={styles.paymentBlock}>
                <div className={styles.qrContainer}>
                  <QRCodeSVG
                    value={paymentUri}
                    size={188}
                    bgColor="#111111"
                    fgColor="#d4af37"
                    level="M"
                    includeMargin
                  />
                </div>

                {btcAmount && (
                  <div className={styles.amountRow}>
                    <div className={styles.amountBig}>
                      <span className={styles.amountBtc}>{btcAmount}</span>
                      <span className={styles.amountUnit}>BTC</span>
                    </div>
                    {btcPrice && (
                      <p className={styles.amountUsd}>
                        ≈ $8.00 USD · 1 BTC = ${btcPrice.toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <div className={styles.addressBlock}>
                  <div className={styles.addressHeader}>
                    <span className={styles.addressLabel}>Bitcoin address</span>
                    <button className={styles.copyBtn} onClick={copyAddress}>
                      {copyFeedback ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className={styles.addressText}>{address}</p>
                </div>

                <div className={styles.statusRow}>
                  <div className={styles.pulsingDot} />
                  <span className={styles.statusText}>Waiting for payment confirmation…</span>
                </div>
                <p className={styles.pollHint}>Checking automatically every 30 seconds</p>
              </div>
            ) : (
              <div className={styles.generating}>
                <div className={styles.generatingSpinner} />
                <p>Generating your Bitcoin address…</p>
              </div>
            )}
          </>
        )}

        <button className={styles.signOutLink} onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  )
}
