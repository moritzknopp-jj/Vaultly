import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import styles from './Paywall.module.css'

interface Props {
  userId: string
  btcAddress: string | null
  onPaymentConfirmed: () => void
  onSignOut: () => void
}

export default function PaywallScreen({ userId, btcAddress, onPaymentConfirmed, onSignOut }: Props) {
  const [btcAmount, setBtcAmount] = useState<string | null>(null)
  const [status, setStatus] = useState<'waiting' | 'confirmed' | 'error'>('waiting')
  const [address, setAddress] = useState(btcAddress)

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch('https://www.blockonomics.co/api/price?currency=USD')
        if (res.ok) {
          const data = await res.json()
          const priceUSD = data.price as number
          const btc = (8 / priceUSD).toFixed(6)
          setBtcAmount(btc)
        }
      } catch {
        setBtcAmount('0.000120') // fallback
      }
    }
    fetchPrice()
  }, [])

  useEffect(() => {
    if (!address) {
      supabase.functions.invoke('generate-btc-address', { body: { user_id: userId } })
        .then(({ data }) => {
          if (data?.btc_address) setAddress(data.btc_address)
        })
    }
  }, [address, userId])

  useEffect(() => {
    const poll = async () => {
      const { data } = await supabase.functions.invoke('verify-payment', {
        body: { user_id: userId },
      })
      if (data?.confirmed) {
        setStatus('confirmed')
        setTimeout(onPaymentConfirmed, 2000)
      }
    }

    poll()
    const interval = setInterval(poll, 30000)
    return () => clearInterval(interval)
  }, [userId, onPaymentConfirmed])

  const paymentUri = address && btcAmount
    ? `bitcoin:${address}?amount=${btcAmount}`
    : address ?? ''

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.icon}>🔐</span>
          <h1 className={styles.title}>Vaultly</h1>
        </div>
        <h2 className={styles.heading}>Your free trial has ended</h2>
        <p className={styles.subtitle}>
          Continue using Vaultly for <strong className={styles.price}>$8/month</strong> paid in Bitcoin
        </p>

        {status === 'confirmed' ? (
          <div className={styles.success}>
            <span className={styles.successIcon}>✅</span>
            <p>Payment confirmed! Unlocking your vault...</p>
          </div>
        ) : (
          <>
            {address ? (
              <div className={styles.qrSection}>
                <div className={styles.qrWrapper}>
                  <QRCodeSVG
                    value={paymentUri}
                    size={200}
                    bgColor="#141414"
                    fgColor="#d4af37"
                    level="M"
                  />
                </div>
                <div className={styles.addressBox}>
                  <p className={styles.addressLabel}>Bitcoin Address</p>
                  <p className={styles.address}>{address}</p>
                </div>
                {btcAmount && (
                  <div className={styles.amountBox}>
                    <p className={styles.amountLabel}>Amount</p>
                    <p className={styles.amount}>{btcAmount} BTC</p>
                    <p className={styles.amountUsd}>≈ $8.00 USD</p>
                  </div>
                )}
                <div className={styles.polling}>
                  <div className={styles.dot} />
                  <p>Waiting for payment...</p>
                </div>
              </div>
            ) : (
              <div className={styles.loading}>Generating payment address...</div>
            )}
          </>
        )}

        <button className={styles.signOut} onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}
