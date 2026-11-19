import { useEffect, useState } from 'react'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { rupees } from '../../lib/config.js'

export default function GiftCards() {
  const call = useAuthedApi()
  const [list, setList] = useState(null)
  const [f, setF] = useState(null)
  const [error, setError] = useState('')
  const load = () => call('/api/admin/gift-cards').then(setList).catch((e) => setError(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function create(e) {
    e.preventDefault(); setError('')
    const value = parseInt(f.value, 10)
    if (!value) return setError('Enter the gift card value in rupees.')
    try {
      await call('/api/admin/gift-cards', { method: 'POST', body: { value, issued_to: f.issued_to || null, phone: f.phone || null, note: f.note || null, expires_at: f.expires ? new Date(f.expires + 'T23:59:59').toISOString() : null } })
      setF(null); load()
    } catch (err) { setError(err.message) }
  }
  const patch = async (g, body) => { try { await call(`/api/admin/gift-cards/${g.id}`, { method: 'PATCH', body }); load() } catch (err) { setError(err.message) } }
  const share = (g) => {
    const text = `🎁 A Lydia Purple Collections gift card for you${g.issued_to ? `, ${g.issued_to}` : ''}!\nCode: ${g.code}\nValue: ${rupees(g.balance)}\nUse it at checkout on ${window.location.origin}${g.expires_at ? `\nValid till ${new Date(g.expires_at).toLocaleDateString('en-IN')}` : ''}`
    window.open(`https://wa.me/${g.phone ? '91' + g.phone : ''}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <>
      <div className="admin-title-row">
        <h1 className="admin-h">Gift cards</h1>
        {!f && <button className="btn btn-primary btn-sm" onClick={() => setF({ value: '', issued_to: '', phone: '', note: '', expires: '' })}>+ New gift card</button>}
      </div>
      <p className="small muted">Create a code worth any amount — as a gift, store credit for a return, or a thank-you. Customers enter it at checkout; it can be used over several orders until the balance runs out.</p>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {f && (
        <form className="card" onSubmit={create} noValidate>
          <div className="field-row">
            <div className="field"><label htmlFor="g-val">Value (₹)</label><input id="g-val" inputMode="numeric" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/\D/g, '') })} placeholder="2000" /></div>
            <div className="field"><label htmlFor="g-exp">Valid till (optional)</label><input id="g-exp" type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label htmlFor="g-to">For (name, optional)</label><input id="g-to" type="text" value={f.issued_to} onChange={(e) => setF({ ...f, issued_to: e.target.value })} /></div>
            <div className="field"><label htmlFor="g-ph">Their WhatsApp (optional)</label><input id="g-ph" type="tel" inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} /></div>
          </div>
          <div className="field"><label htmlFor="g-note">Note (only you see this)</label><input id="g-note" type="text" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Store credit for exchange of order LPC1012" /></div>
          <div className="row-gap"><button className="btn btn-primary btn-sm">Create gift card</button><button type="button" className="btn btn-outline btn-sm" onClick={() => setF(null)}>Cancel</button></div>
        </form>
      )}
      {!list ? <div className="skeleton-block" /> : list.length ? (
        <ul className="coupon-list">
          {list.map((g) => {
            const expired = g.expires_at && new Date(g.expires_at) < new Date()
            return (
              <li key={g.id} className="card">
                <div>
                  <strong className="coupon-code">{g.code}</strong>
                  <span className={`pill ${!g.is_active || expired ? 'pill-red' : g.balance ? 'pill-green' : ''}`}>{!g.is_active ? 'Off' : expired ? 'Expired' : g.balance ? 'Active' : 'Used up'}</span>
                  <p className="small"><strong>{rupees(g.balance)}</strong> left of {rupees(g.initial_value)}{g.orders ? ` · used on ${g.orders} order${g.orders === 1 ? '' : 's'}` : ''}{g.expires_at && ` · till ${new Date(g.expires_at).toLocaleDateString('en-IN')}`}</p>
                  {(g.issued_to || g.note) && <p className="small muted">{[g.issued_to, g.note].filter(Boolean).join(' · ')}</p>}
                </div>
                <div className="row-gap">
                  <button className="btn btn-wa btn-sm" onClick={() => share(g)}>Send on WhatsApp</button>
                  <button className="btn btn-outline btn-sm" onClick={() => { const v = parseInt(window.prompt('Add how many rupees?', '500') || '', 10); if (v > 0) patch(g, { add: v }) }}>Top up</button>
                  <button className="btn btn-outline btn-sm danger" onClick={() => patch(g, { is_active: !g.is_active })}>{g.is_active ? 'Turn off' : 'Turn on'}</button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : <p className="muted">No gift cards yet.</p>}
    </>
  )
}
