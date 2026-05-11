import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { registerDevice } from '../../lib/deviceId'
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

    if (!data.session || !data.user) {
      setError('Check your email to confirm your account.')
      setLoading(false)
      return
    }

    // Create users_meta row
    const { error: metaError } = await supabase.from('users_meta').insert({
      id: data.user.id,
      trial_start: new Date().toISOString(),
      is_paid: false,
      paid_until: null,
      device_ids: [],
      btc_address: null,
    })

    if (metaError) {
      console.error('Failed to create user meta:', metaError)
    }

    // Register device
    const deviceResult = await registerDevice(data.user.id)
    if (!deviceResult.success) {
      setError(deviceResult.error ?? 'Device registration failed')
      setLoading(false)
      return
    }

    // Generate BTC address via edge function
    try {
      await supabase.functions.invoke('generate-btc-address', {
        body: { user_id: data.user.id },
      })
    } catch (err) {
      console.warn('Failed to generate BTC address:', err)
    }

    onSuccess(data.session)
    setLoading(false)
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🔐</span>
          <h1 className={styles.logoText}>Vaultly</h1>
        </div>
        <p className={styles.subtitle}>Start your 30-day free trial</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={styles.input}
              placeholder="you@example.com"
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
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className={styles.switchText}>
          Already have an account?{' '}
          <button className={styles.link} onClick={onLoginClick}>
            Sign in
          </button>
        </p>

        <p className={styles.terms}>
          30-day free trial, then $8/month via Bitcoin
        </p>
      </div>
    </div>
  )
}
