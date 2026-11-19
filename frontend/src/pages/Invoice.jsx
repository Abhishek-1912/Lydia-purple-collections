import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuthedApi } from '../context/AuthContext.jsx'
import { api } from '../lib/api.js'
import { useTitle } from '../lib/store.js'

const money = (n) => (n < 0 ? '−₹' : '₹') + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const addr = (a = {}) => [a.line1, a.line2, a.landmark && `Near ${a.landmark}`, a.city, a.state && `${a.state} – ${a.pin || ''}`].filter(Boolean).join(', ')

/** Printable invoice. admin=true → /admin/invoice/:id (any confirmed order); else customer link /order/:id/invoice. */
export default function Invoice({ admin = false }) {
  const { id } = useParams()
  const call = useAuthedApi()
  const [inv, setInv] = useState(null)
  const [error, setError] = useState('')
  useTitle(inv ? `${inv.title} ${inv.number || inv.order_no}` : 'Invoice')
  useEffect(() => {
    (admin ? call(`/api/admin/orders/${id}/invoice`) : api(`/api/orders/${id}/invoice`)).then(setInv).catch((e) => setError(e.message))
  }, [id, admin, call])

  if (error) return <section className="container page-narrow"><p className="alert alert-error">{error}</p><Link to={admin ? '/admin/orders' : `/order/${id}`} className="btn btn-outline">Back</Link></section>
  if (!inv) return <section className="container section"><div className="skeleton-block" /></section>
  const t = inv.totals
  return (
    <section className="container section">
      <div className="no-print admin-title-row">
        <Link to={admin ? '/admin/orders' : `/order/${id}`} className="btn btn-outline btn-sm">Back</Link>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <article className="invoice">
        <header className="inv-head">
          <div>
            <img src="/logo-mark.webp" alt="" width="56" height="56" />
            <div><strong>{inv.seller.name}</strong><br /><small>{inv.seller.address}</small>
              {inv.seller.gstin && <><br /><small>GSTIN: <strong>{inv.seller.gstin}</strong> · State: {inv.seller.state}</small></>}
              {(inv.seller.phone || inv.seller.email) && <><br /><small>{[inv.seller.phone, inv.seller.email].filter(Boolean).join(' · ')}</small></>}
            </div>
          </div>
          <div className="inv-meta">
            <h1>{inv.title}</h1>
            {inv.number && <p>No. <strong>{inv.number}</strong></p>}
            <p>Date: {new Date(inv.date + 'T00:00:00').toLocaleDateString('en-IN')}</p>
            <p>Order: {inv.order_no}</p>
          </div>
        </header>
        <div className="inv-buyer">
          <small>BILL / SHIP TO</small>
          <p><strong>{inv.buyer.name}</strong><br />{addr(inv.buyer.address)}<br />Phone: +91 {inv.buyer.phone}</p>
          {inv.gst && <p className="small">Place of supply: {inv.buyer.state} · {inv.same_state ? 'CGST + SGST' : 'IGST'}</p>}
        </div>
        <table className="inv-table">
          <thead><tr><th>Item</th>{inv.gst && <th>HSN</th>}<th className="num">Qty</th><th className="num">Rate</th>{inv.gst && <th className="num">Taxable</th>}{inv.gst && (inv.same_state ? <><th className="num">CGST {inv.rate / 2}%</th><th className="num">SGST {inv.rate / 2}%</th></> : <th className="num">IGST {inv.rate}%</th>)}<th className="num">Amount</th></tr></thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i}><td>{l.description}</td>{inv.gst && <td>{l.hsn}</td>}<td className="num">{l.qty}</td><td className="num">{money(l.rate)}</td>{inv.gst && <td className="num">{money(l.taxable)}</td>}{inv.gst && (inv.same_state ? <><td className="num">{money(l.cgst)}</td><td className="num">{money(l.sgst)}</td></> : <td className="num">{money(l.igst)}</td>)}<td className="num">{money(l.gross)}</td></tr>
            ))}
          </tbody>
          <tfoot>
            {inv.gst && <tr><td colSpan={inv.same_state ? 4 : 4}>Total taxable value</td><td className="num">{money(t.taxable)}</td>{inv.same_state ? <><td className="num">{money(t.cgst)}</td><td className="num">{money(t.sgst)}</td></> : <td className="num">{money(t.igst)}</td>}<td className="num">{money(t.gross)}</td></tr>}
            {Math.abs(t.round_off) >= 0.01 && <tr><td colSpan="20">Round off: {money(t.round_off)}</td></tr>}
            <tr className="inv-grand"><td colSpan="20">Total (incl. GST): <strong>{money(t.grand)}</strong><br /><small>{inv.in_words}</small></td></tr>
          </tfoot>
        </table>
        <p className="small">
          Payment: {inv.payment === 'cod' ? (inv.payment_status === 'paid' ? 'Cash on Delivery (paid)' : 'Cash on Delivery') : inv.payment === 'gift' ? 'Gift card' : 'Paid online'}
          {inv.gift_amount > 0 && ` · ₹${inv.gift_amount.toLocaleString('en-IN')} paid by gift card`}
        </p>
        {!inv.gst && <p className="small muted">Prices include all applicable taxes.</p>}
        <p className="small muted">This is a computer-generated {inv.gst ? 'invoice' : 'receipt'} and needs no signature.</p>
      </article>
    </section>
  )
}
