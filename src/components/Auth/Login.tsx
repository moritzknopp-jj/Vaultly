import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Logo from '../Logo'
import type { Session } from '@supabase/supabase-js'
import styles from './Auth.module.css'

interface Props {
  onSuccess: (session: Session) => void
  onRegisterClick: () => void
}

export default function Login({ onSuccess, onRegisterClick }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      onSuccess(data.session)
    } else {
      setError('No session returned. Please try again.')
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email address above, then click "Forgot password".')
      return
    }
    setResetLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setResetLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.logoRow}>
        <Logo size={36} />
        <h1 className={styles.appName}>Vaultly</h1>
      </div>
      <p className={styles.tagline}>Chat with your Obsidian vault using local AI</p>

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
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className={styles.errorBox}>
            <span className={styles.errorIcon}>⚠</span>
            {error}
          </div>
        )}

        {resetSent && (
          <div className={styles.successBox}>
            Password reset email sent — check your inbox.
          </div>
        )}

        <button type="submit" className={styles.primaryBtn} disabled={loading}>
          {loading ? (
            <span className={styles.btnContent}>
              <span className={styles.btnSpinner} />
              Signing in...
            </span>
          ) : 'Sign In'}
        </button>
      </form>

      <button
        className={styles.forgotBtn}
        onClick={handleForgotPassword}
        disabled={resetLoading}
        type="button"
      >
        {resetLoading ? 'Sending…' : 'Forgot password?'}
      </button>

      <div className={styles.divider}>
        <span>New to Vaultly?</span>
      </div>

      <button className={styles.secondaryBtn} onClick={onRegisterClick}>
        Create account — 7 days free
      </button>
    </div>
  )
}
