import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Stars from '../../components/Stars.jsx'
import { useAuthedApi } from '../../context/AuthContext.jsx'

const TABS = [['pending', 'Waiting'], ['approved', 'Shown'], ['rejected', 'Hidden'], ['all', 'All']]

function Item({ r, onChange, onRemove }) {
  const call = useAuthedApi()
  const [reply, setReply] = useState(r.reply || '')
  const [busy, setBusy] = useState(false)
  const act = async (body) => { setBusy(true); try { onChange(await call(`/api/admin/reviews/${r.id}`, { method: 'PATCH', body })) } finally { setBusy(false) } }
  return (
    <li className="card rv-admin">
      <div className="rv-head"><Stars value={r.rating} label={false} /> <strong>{r.title}</strong> <span className={`pill ${r.status === 'approved' ? 'pill-green' : r.status === 'rejected' ? 'pill-red' : 'pill-amber'}`}>{r.status === 'approved' ? 'Shown' : r.status === 'rejected' ? 'Hidden' : 'Waiting'}</span></div>
      <p className="small muted">{r.name}{r.order_id && ' · ✓ Verified buyer'} · {new Date(r.created_at).toLocaleDateString('en-IN')} · on <Link to={`/products/${r.products?.slug}`} target="_blank">{r.products?.name}</Link></p>
      <p>{r.body}</p>
      {r.photos?.length > 0 && <div className="rv-photos">{r.photos.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" /></a>)}</div>}
      <div className="field"><label htmlFor={`rp-${r.id}`} className="small">Public reply (optional)</label>
        <input id={`rp-${r.id}`} type="text" value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)} placeholder="Thank you! So happy you loved it." /></div>
      <div className="row-gap">
        {r.status !== 'approved' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act({ status: 'approved', reply })}>✓ Show on site</button>}
        {r.status === 'approved' && reply !== (r.reply || '') && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act({ reply })}>Save reply</button>}
        {r.status !== 'rejected' && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => act({ status: 'rejected' })}>Hide</button>}
        <button className="btn btn-outline btn-sm danger" disabled={busy} onClick={async () => { if (window.confirm('Delete this review for good?')) { await call(`/api/admin/reviews/${r.id}`, { method: 'DELETE' }); onRemove(r.id) } }}>Delete</button>
      </div>
    </li>
  )
}

export default function AdminReviews() {
  const call = useAuthedApi()
  const [tab, setTab] = useState('pending')
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { setList(null); call(`/api/admin/reviews?status=${tab}`).then(setList).catch((e) => setError(e.message)) }, [call, tab])
  return (
    <>
      <h1 className="admin-h">Reviews</h1>
      <p className="small muted">Customers who bought a product can review it. Reviews show on the site only after you press “Show on site”.</p>
      <div className="chips">{TABS.map(([v, l]) => <button key={v} className={`chip ${tab === v ? 'active' : ''}`} onClick={() => setTab(v)}>{l}</button>)}</div>
      {error && <p className="alert alert-error">{error}</p>}
      {!list ? <div className="skeleton-block" /> : list.length ? (
        <ul className="coupon-list">{list.map((r) => <Item key={r.id} r={r} onChange={(n) => setList((all) => all.map((x) => x.id === n.id ? { ...x, ...n } : x).filter((x) => tab === 'all' || x.status === tab))} onRemove={(id) => setList((all) => all.filter((x) => x.id !== id))} />)}</ul>
      ) : <p className="muted">{tab === 'pending' ? 'No reviews waiting. 🎉' : 'Nothing here.'}</p>}
    </>
  )
}
