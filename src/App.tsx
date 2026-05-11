import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { registerDevice } from './lib/deviceId'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import ChatWindow from './components/Chat/ChatWindow'
import PaywallScreen from './components/Paywall/PaywallScreen'
import TitleBar from './components/TitleBar'
import Logo from './components/Logo'
import type { Session } from '@supabase/supabase-js'
import styles from './App.module.css'

type AppView = 'login' | 'register' | 'chat' | 'paywall'

interface UserMeta {
  trial_start: string
  is_paid: boolean
  paid_until: string | null
  btc_address: string | null
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [view, setView] = useState<AppView>('login')
  const [userMeta, setUserMeta] = useState<UserMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number>(30)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        onSessionReady(session)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        onSessionReady(session)
      } else {
        setView('login')
        setUserMeta(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function onSessionReady(session: Session) {
    setLoading(true)
    try {
      await registerDevice(session.user.id)
    } catch {
      // ignore device registration errors silently
    }
    await checkSubscription(session.user.id)
  }

  async function checkSubscription(userId: string) {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users_meta')
        .select('trial_start, is_paid, paid_until, btc_address')
        .eq('id', userId)
        .single()

      if (error || !data) {
        setView('login')
        setLoading(false)
        return
      }

      setUserMeta(data)

      const now = new Date()
      const trialEnd = new Date(data.trial_start)
      trialEnd.setDate(trialEnd.getDate() + 30)
      const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      setTrialDaysLeft(daysLeft)

      if (data.is_paid && data.paid_until && new Date(data.paid_until) > now) {
        setView('chat')
      } else if (!data.is_paid && now < trialEnd) {
        setView('chat')
      } else {
        setView('paywall')
      }
    } catch {
      setView('login')
    } finally {
      setLoading(false)
    }
  }

  function handleAuthSuccess(session: Session) {
    setSession(session)
    onSessionReady(session)
  }

  function handlePaymentConfirmed() {
    if (session) checkSubscription(session.user.id)
  }

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <TitleBar />
        <div className={styles.loadingContent}>
          <Logo size={48} />
          <p className={styles.loadingText}>Vaultly</p>
          <div className={styles.loadingSpinner} />
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className={styles.authScreen}>
        <TitleBar />
        <div className={styles.authContent}>
          {view === 'register' ? (
            <Register onSuccess={handleAuthSuccess} onLoginClick={() => setView('login')} />
          ) : (
            <Login onSuccess={handleAuthSuccess} onRegisterClick={() => setView('register')} />
          )}
        </div>
      </div>
    )
  }

  if (view === 'paywall') {
    return (
      <div className={styles.fullScreen}>
        <TitleBar />
        <PaywallScreen
          userId={session.user.id}
          btcAddress={userMeta?.btc_address ?? null}
          onPaymentConfirmed={handlePaymentConfirmed}
          onSignOut={() => supabase.auth.signOut()}
        />
      </div>
    )
  }

  return (
    <div className={styles.fullScreen}>
      <ChatWindow
        session={session}
        trialDaysLeft={trialDaysLeft}
        isPaid={userMeta?.is_paid ?? false}
        onSignOut={() => supabase.auth.signOut()}
      />
    </div>
  )
}
