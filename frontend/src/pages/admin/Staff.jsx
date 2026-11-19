import { useEffect, useState } from 'react'
import { useAuth, useAuthedApi } from '../../context/AuthContext.jsx'

export default function Staff() {
  const call = useAuthedApi()
  const { user } = useAuth()
  const [list, setList] = useState(null)
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })
  useEffect(() => { call('/api/admin/staff').then(setList).catch((e) => setMsg({ type: 'error', text: e.message })) }, [call])

  async function setAdmin(addr, admin) {
    if (!admin && !window.confirm(`Remove admin access for ${addr}?`)) return
    setMsg({ type: '', text: '' })
    try {
      setList(await call('/api/admin/staff', { method: 'PUT', body: { email: addr, admin } }))
      if (admin) { setEmail(''); setMsg({ type: 'ok', text: `${addr} is now an admin. They see the Admin button after refreshing the site.` }) }
    } catch (e) { setMsg({ type: 'error', text: e.message }) }
  }

  return (
    <>
      <h1 className="admin-h">Staff &amp; admins</h1>
      <p className="small muted">Admins can see orders, products, customers and settings. The person must sign in on the website once (with their email) before you can add them.</p>
      <form className="card" onSubmit={(e) => { e.preventDefault(); if (email.trim()) setAdmin(email.trim(), true) }}>
        <div className="coupon-form">
          <label htmlFor="staff-email" className="sr-only">Email</label>
          <input id="staff-email" type="email" placeholder="staff@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-primary btn-sm">Make admin</button>
        </div>
      </form>
      {msg.text && <p className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</p>}
      {!list ? <div className="skeleton-block" /> : (
        <ul className="coupon-list">
          {list.map((s) => (
            <li key={s.id} className="card">
              <div><strong>{s.full_name || s.email}</strong>{s.id === user?.id && <span className="pill">You</span>}<p className="small muted">{s.email}</p></div>
              {s.id !== user?.id && <button className="btn btn-outline btn-sm danger" onClick={() => setAdmin(s.email, false)}>Remove admin</button>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
