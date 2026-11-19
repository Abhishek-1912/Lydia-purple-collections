import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Lotus } from '../components/Icons.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { authEnabled } from '../lib/supabase.js'
import { useTitle } from '../lib/store.js'

export default function Login() {
  useTitle('Sign in')
  const { user, loading, sendCode, verifyCode, signOut, isAdmin } = useAuth()
  const [params] = useSearchParams()
  const next = params.get('next') || ''
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    if (user && next) navigate(next, { replace: true })
  }, [user, next, navigate])

  if (!authEnabled) return <section className="container page-narrow"><p className="alert alert-error">Sign-in is not set up yet (missing Supabase keys in frontend/.env).</p></section>
  if (loading) return <section className="container page-narrow"><div className="skeleton-block" /></section>

  if (user) {
    return (
      <section className="container page-narrow center">
        <div className="gold"><Lotus size={48} /></div>
        <h1>You’re signed in</h1>
        <p className="muted">{user.email}</p>
        <div className="stack">
          <Link to="/account" className="btn btn-primary btn-block">My orders</Link>
          {isAdmin && <Link to="/admin" className="btn btn-outline btn-block">Admin panel</Link>}
          <button className="btn btn-outline btn-block" onClick={signOut}>Sign out</button>
        </div>
      </section>
    )
  }

  async function onSend(e) {
    e?.preventDefault()
    setError('')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError('Please enter a valid email address.'); return }
    setBusy(true)
    try {
      await sendCode(email.trim().toLowerCase(), next)
      setStep('code')
      setCooldown(60)
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  async function onVerify(e) {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your email.'); return }
    setBusy(true)
    try {
      await verifyCode(email.trim().toLowerCase(), code)
      navigate(next || '/account', { replace: true })
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  return (
    <section className="container page-narrow">
      <div className="center">
        <div className="gold"><Lotus size={48} /></div>
        <h1>Sign in</h1>
        <p className="muted">No password needed — we’ll email you a sign-in code or link. New here? This creates your account.</p>
      </div>
      <div className="card">
        {step === 'email' ? (
          <form onSubmit={onSend} noValidate>
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            {error && <p className="alert alert-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
          </form>
        ) : (
          <form onSubmit={onVerify} noValidate>
            <p className="small">We sent an email to <strong>{email}</strong>. <strong>Click the link in it</strong>, or type the 6-digit code if it has one. <button type="button" className="link-btn" onClick={() => { setStep('email'); setCode(''); setError('') }}>Change</button></p>
            <div className="field">
              <label htmlFor="code">6-digit code (if your email has one)</label>
              <input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" className="otp-input"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus />
            </div>
            {error && <p className="alert alert-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Checking…' : 'Sign in'}</button>
            <p className="small center">
              {cooldown ? `Resend code in ${cooldown}s` : <button type="button" className="link-btn" onClick={onSend}>Resend code</button>}
            </p>
          </form>
        )}
      </div>
    </section>
  )
}
