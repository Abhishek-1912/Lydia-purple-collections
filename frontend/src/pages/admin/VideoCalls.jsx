import { useEffect, useState } from 'react'
import { useAuthedApi } from '../../context/AuthContext.jsx'

const fmt = (iso) => new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function Row({ c, onChange }) {
  const call = useAuthedApi()
  const [link, setLink] = useState(c.link || '')
  const [error, setError] = useState('')
  async function update(body) {
    setError('')
    try { onChange(await call(`/api/admin/video-calls/${c.id}`, { method: 'PATCH', body })) } catch (e) { setError(e.message) }
  }
  function confirmAndSend() {
    const text = `Hi ${c.name}! Your video call with Lydia Purple Collections is confirmed for ${fmt(c.slot)}.${link ? `\nJoin here: ${link}` : '\nWe will call you on WhatsApp video at that time.'}${c.products?.name ? `\nWe'll show you: ${c.products.name}` : ''}`
    window.open(`https://wa.me/91${c.phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    update({ status: 'confirmed', link: link || null })
  }
  return (
    <li className={`card vc-row ${c.status}`}>
      <div>
        <strong>{fmt(c.slot)}</strong> <span className={`pill ${c.status === 'confirmed' ? 'pill-green' : c.status === 'requested' ? 'pill-amber' : c.status === 'cancelled' ? 'pill-red' : ''}`}>{{ requested: 'New request', confirmed: 'Confirmed', done: 'Done', cancelled: 'Cancelled' }[c.status]}</span>
        <p className="small">{c.name} · +91 {c.phone}{c.email ? ` · ${c.email}` : ''}</p>
        {c.products?.name && <p className="small">For: <a href={`/products/${c.products.slug}`} target="_blank" rel="noreferrer">{c.products.name}</a></p>}
        {c.note && <p className="small muted">“{c.note}”</p>}
      </div>
      {['requested', 'confirmed'].includes(c.status) && (
        <div className="vc-actions">
          <label className="small">Call link (optional — Google Meet, or leave blank to call on WhatsApp)
            <input type="url" value={link} placeholder="https://meet.google.com/…" onChange={(e) => setLink(e.target.value)} />
          </label>
          <div className="row-gap">
            <button type="button" className="btn btn-wa btn-sm" onClick={confirmAndSend}>{c.status === 'confirmed' ? 'Send again' : 'Confirm on WhatsApp'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => update({ status: 'done' })}>Done</button>
            <button type="button" className="btn btn-outline btn-sm danger" onClick={() => window.confirm('Cancel this call?') && update({ status: 'cancelled' })}>Cancel</button>
          </div>
          {error && <p className="small line-error">{error}</p>}
        </div>
      )}
    </li>
  )
}

export default function VideoCalls() {
  const call = useAuthedApi()
  const [show, setShow] = useState('upcoming')
  const [list, setList] = useState(null)
  useEffect(() => { setList(null); call(`/api/admin/video-calls?show=${show}`).then(setList).catch(() => setList([])) }, [call, show])
  return (
    <>
      <h1 className="admin-h">Video calls</h1>
      <p className="small muted">Shoppers book a time on the website. Confirm with one tap — it opens WhatsApp with the time and link. Turn booking on and set your hours in Settings → Video-call booking.</p>
      <div className="chips">
        <button className={`chip ${show === 'upcoming' ? 'active' : ''}`} onClick={() => setShow('upcoming')}>Upcoming</button>
        <button className={`chip ${show === 'all' ? 'active' : ''}`} onClick={() => setShow('all')}>All</button>
      </div>
      {!list ? <div className="skeleton-block" /> : list.length ? (
        <ul className="coupon-list">{list.map((c) => <Row key={c.id} c={c} onChange={(n) => setList((all) => all.map((x) => x.id === n.id ? { ...x, ...n } : x))} />)}</ul>
      ) : <p className="muted">No video calls booked.</p>}
    </>
  )
}
