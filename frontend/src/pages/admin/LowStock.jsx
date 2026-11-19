import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProductImage from '../../components/ProductImage.jsx'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { swatchBg } from '../../lib/shades.js'

function Row({ v, onSaved }) {
  const call = useAuthedApi()
  const [n, setN] = useState(v.stock)
  const [state, setState] = useState('') // '' | saving | saved | error
  const changed = n !== v.stock

  async function save() {
    setState('saving')
    try {
      await call(`/api/admin/products/${v.product_id}/quick`, { method: 'PATCH', body: { variants: [{ id: v.variant_id, stock: n }] } })
      setState('saved')
      setTimeout(onSaved, 900)
    } catch { setState('error') }
  }

  return (
    <li className={`ls-row ${v.stock === 0 ? 'out' : ''}`}>
      <Link to={`/admin/products/${v.product_id}`} className="ls-thumb" tabIndex={-1} aria-hidden="true">
        <ProductImage src={v.image} alt="" hex={v.color_hex} />
      </Link>
      <div className="ls-info">
        <Link to={`/admin/products/${v.product_id}`} className="ls-name">{v.name}</Link>
        <span className="ls-variant">
          {v.color && <span className="dot xs" style={{ background: swatchBg(v.color_hex, v.color_hex2) }} />}
          {[v.color, v.size].filter(Boolean).join(' · ') || 'Single item'}
        </span>
        <span className={`pill ${v.stock === 0 ? 'pill-red' : 'pill-amber'}`}>{v.stock === 0 ? 'Sold out' : `${v.stock} left`}</span>
      </div>
      <div className="ls-restock" aria-label={`Restock ${v.name}${v.color ? ' ' + v.color : ''}`}>
        <div className="qty">
          <button type="button" onClick={() => setN(Math.max(0, n - 1))} aria-label="One less" disabled={n <= 0}>−</button>
          <input value={n} inputMode="numeric" aria-label="Pieces in stock"
            onChange={(e) => setN(Math.min(999, parseInt(e.target.value.replace(/\D/g, '') || '0', 10)))} />
          <button type="button" onClick={() => setN(Math.min(999, n + 1))} aria-label="One more">+</button>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!changed || state === 'saving'}>
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : 'Save'}
        </button>
        {state === 'error' && <span className="small line-error">Couldn’t save. Try again.</span>}
      </div>
    </li>
  )
}

/** Dashboard panel: items at or below the owner's alert level, restockable in place. */
export default function LowStock({ items, threshold, onChange }) {
  const sorted = [...items].sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name))
  const out = items.filter((v) => v.stock === 0).length
  return (
    <section className="card ls">
      <div className="ls-head">
        <div>
          <h2 className="admin-h2">Running low</h2>
          <p className="small muted">Items with {threshold} or fewer {threshold === 1 ? 'piece' : 'pieces'}{out > 0 && <> · <strong className="line-error">{out} sold out</strong></>}. Change the number and press Save to restock.</p>
        </div>
        <Link to="/admin/settings" className="link-btn small">Change alert level</Link>
      </div>
      {sorted.length ? (
        <ul className="ls-list">{sorted.map((v) => <Row key={v.variant_id} v={v} onSaved={onChange} />)}</ul>
      ) : (
        <div className="ls-empty"><span aria-hidden="true">✓</span> All stocked up — nothing is at {threshold} {threshold === 1 ? 'piece' : 'pieces'} or fewer.</div>
      )}
    </section>
  )
}
