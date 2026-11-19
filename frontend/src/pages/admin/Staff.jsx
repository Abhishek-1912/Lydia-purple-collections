import { useEffect, useState } from 'react'
import { useAuth, useAuthedApi } from '../../context/AuthContext.jsx'

export default function Staff() {
  const call = useAuthedApi()
  const { user } = useAuth()
  const [list, setList] = useState(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('packer')
  const [msg, setMsg] = useState({ type: '', text: '' })
  useEffect(() => { call('/api/admin/staff').then(setList).catch((e) => setMsg({ type: 'error', text: e.message })) }, [call])

  async function setRoleFor(addr, newRole) {
    if (newRole === 'customer' && !window.confirm(`Remove staff access for ${addr}?`)) return
    setMsg({ type: '', text: '' })
    try {
      setList(await call('/api/admin/staff', { method: 'PUT', body: { email: addr, role: newRole } }))
      if (newRole !== 'customer') { setEmail(''); setMsg({ type: 'ok', text: newRole === 'admin' ? `${addr} is now an admin.` : `${addr} is now a packer — they see only orders to pack. They see the button after refreshing the site.` }) }
    } catch (e) { setMsg({ type: 'error', text: e.message }) }
  }

  return (
    <>
      <h1 className="admin-h">Staff &amp; admins</h1>
      <p className="small muted">Admins can do everything. Packers only see orders to pack: they can add tracking, mark packed/shipped and print slips and invoices — no sales figures, products, customers or settings. The person must sign in on the website once (with their email) before you can add them.</p>
      <form className="card" onSubmit={(e) => { e.preventDefault(); if (email.trim()) setRoleFor(email.trim(), role) }}>
        <div className="coupon-form">
          <label htmlFor="staff-email" className="sr-only">Email</label>
          <input id="staff-email" type="email" placeholder="staff@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" style={{ width: 'auto' }}><option value="packer">Packer (orders only)</option><option value="admin">Admin (everything)</option></select>
          <button className="btn btn-primary btn-sm">Add</button>
        </div>
      </form>
      {msg.text && <p className={`alert ${msg.type === 'ok' ? 'alert-ok' : 'alert-error'}`} role="status">{msg.text}</p>}
      {!list ? <div className="skeleton-block" /> : (
        <ul className="coupon-list">
          {list.map((s) => (
            <li key={s.id} className="card">
              <div><strong>{s.full_name || s.email}</strong> <span className={`pill ${s.role === 'admin' ? 'pill-confirmed' : 'pill-packed'}`}>{s.role === 'admin' ? 'Admin' : 'Packer'}</span>{s.id === user?.id && <span className="pill">You</span>}<p className="small muted">{s.email}</p></div>
              {s.id !== user?.id && <div className="row-gap"><button className="btn btn-outline btn-sm" onClick={() => setRoleFor(s.email, s.role === 'admin' ? 'packer' : 'admin')}>Make {s.role === 'admin' ? 'packer' : 'admin'}</button><button className="btn btn-outline btn-sm danger" onClick={() => setRoleFor(s.email, 'customer')}>Remove</button></div>}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
