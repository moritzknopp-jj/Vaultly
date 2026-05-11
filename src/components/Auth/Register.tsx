import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { registerDevice } from '../../lib/deviceId'
import Logo from '../Logo'
import type { Session } from '@supabase/supabase-js'
import styles from './Auth.module.css'

interface Props {
  onSuccess: (session: Session) => void
  onLoginClick: () => void
}

export default function Register({ onSuccess, onLoginClick }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'confirm-email'>('form')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Registration failed. Please try again.')
      setLoading(false)
      return
    }

    await supabase.from('users_meta').upsert({
      id: data.user.id,
      trial_start: new Date().toISOString(),
      is_paid: false,
      paid_until: null,
      device_ids: [],
      btc_address: null,
    }, { onConflict: 'id', ignoreDuplicates: true })

    if (!data.session) {
      setStep('confirm-email')
      setLoading(false)
      return
    }

    const deviceResult = await registerDevice(data.user.id)
    if (!deviceResult.success && deviceResult.error) {
      setError(deviceResult.error)
      setLoading(false)
      return
    }

    supabase.functions.invoke('generate-btc-address', {
      body: { user_id: data.user.id },
    }).catch(console.warn)

    onSuccess(data.session)
    setLoading(false)
  }

  if (step === 'confirm-email') {
    return (
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <Logo size={36} />
          <h1 className={styles.appName}>Vaultly</h1>
        </div>
        <div className={styles.confirmBox}>
          <span className={styles.confirmIcon}>📧</span>
          <h2 className={styles.confirmTitle}>Check your email</h2>
          <p className={styles.confirmText}>
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <button className={styles.primaryBtn} onClick={onLoginClick} style={{ marginTop: 8 }}>
            Go to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.logoRow}>
        <Logo size={36} />
        <h1 className={styles.appName}>Vaultly</h1>
      </div>
      <p className={styles.tagline}>30-day free trial · then $8/month via Bitcoin</p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={styles.input}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={styles.input}
            placeholder="Min 6 characters"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        {error && (
          <div className={styles.errorBox}>
            <span className={styles.errorIcon}>⚠</span>
            {error}
          </div>
        )}

        <button type="submit" className={styles.primaryBtn} disabled={loading}>
          {loading ? (
            <span className={styles.btnContent}>
              <span className={styles.btnSpinner} />
              Creating account...
            </span>
          ) : 'Start Free Trial'}
        </button>
      </form>

      <div className={styles.divider}>
        <span>Already have an account?</span>
      </div>

      <button className={styles.secondaryBtn} onClick={onLoginClick}>
        Sign in
      </button>
    </div>
  )
}
