import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/Auth/Login'
import Register from './components/Auth/Register'
import ChatWindow from './components/Chat/ChatWindow'
import PaywallScreen from './components/Paywall/PaywallScreen'
import type { Session } from '@supabase/supabase-js'

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        checkSubscription(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        checkSubscription(session.user.id)
      } else {
        setView('login')
        setUserMeta(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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

      const trialEnd = new Date(data.trial_start)
      trialEnd.setDate(trialEnd.getDate() + 30)
      const now = new Date()

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
    checkSubscription(session.user.id)
  }

  function handlePaymentConfirmed() {
    if (session) checkSubscription(session.user.id)
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a0a', color: '#d4af37',
        fontSize: '14px', letterSpacing: '0.05em'
      }}>
        Loading Vaultly...
      </div>
    )
  }

  if (!session) {
    if (view === 'register') {
      return <Register onSuccess={handleAuthSuccess} onLoginClick={() => setView('login')} />
    }
    return <Login onSuccess={handleAuthSuccess} onRegisterClick={() => setView('register')} />
  }

  if (view === 'paywall') {
    return (
      <PaywallScreen
        userId={session.user.id}
        btcAddress={userMeta?.btc_address ?? null}
        onPaymentConfirmed={handlePaymentConfirmed}
        onSignOut={() => supabase.auth.signOut()}
      />
    )
  }

  return <ChatWindow session={session} onSignOut={() => supabase.auth.signOut()} />
}
