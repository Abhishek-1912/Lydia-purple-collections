import { useEffect, useState } from 'react'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { rupees } from '../../lib/config.js'

const BLANK = { code: '', discount_type: 'percent', value: '', min_order: '', max_discount: '', starts_at: '', ends_at: '', usage_limit: '', is_active: true }
const toLocal = (iso) => iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
const num = (v) => v === '' || v === null ? null : parseInt(v, 10)

export default function Coupons() {
  const call = useAuthedApi()
  const [list, setList] = useState(null)
  const [form, setForm] = useState(null)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')

  const load = () => call('/api/admin/coupons').then(setList).catch((e) => setError(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  function edit(c) {
    setEditId(c.id)
    setForm({ ...c, value: c.value, min_order: c.min_order || '', max_discount: c.max_discount || '', usage_limit: c.usage_limit || '', starts_at: toLocal(c.starts_at), ends_at: toLocal(c.ends_at) })
  }

  async function save(e) {
    e.preventDefault()
    setError('')
    const body = {
      code: form.code.trim().toUpperCase(), discount_type: form.discount_type, value: num(form.value), min_order: num(form.min_order) || 0,
      max_discount: form.discount_type === 'percent' ? num(form.max_discount) : null, usage_limit: num(form.usage_limit),
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null, ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: form.is_active,
    }
    if (!body.value) return setError('Please enter the discount value.')
    try {
      await call(editId ? `/api/admin/coupons/${editId}` : '/api/admin/coupons', { method: editId ? 'PUT' : 'POST', body })
      setForm(null); setEditId(null); load()
    } catch (err) { setError(err.message) }
  }

  async function remove(c) {
    if (!window.confirm(`Delete coupon ${c.code}?`)) return
    await call(`/api/admin/coupons/${c.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <>
      <div className="admin-title-row">
        <h1 className="admin-h">Coupons</h1>
        {!form && <button className="btn btn-primary btn-sm" onClick={() => { setForm(BLANK); setEditId(null) }}>+ New coupon</button>}
      </div>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {form && (
        <form className="card" onSubmit={save} noValidate>
          <div className="field-row">
            <div className="field"><label htmlFor="c-code">Code</label><input id="c-code" type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} placeholder="DIWALI500" /></div>
            <div className="field"><label htmlFor="c-type">Type</label>
              <select id="c-type" value={form.discount_type} onChange={set('discount_type')}><option value="percent">Percent off</option><option value="flat">Flat ₹ off</option></select>
            </div>
          </div>
          <div className="field-row">
            <div className="field"><label htmlFor="c-val">{form.discount_type === 'percent' ? 'Percent (%)' : 'Amount (₹)'}</label><input id="c-val" inputMode="numeric" value={form.value} onChange={set('value')} /></div>
            {form.discount_type === 'percent' && <div className="field"><label htmlFor="c-max">Max discount (₹, optional)</label><input id="c-max" inputMode="numeric" value={form.max_discount} onChange={set('max_discount')} /></div>}
          </div>
          <div className="field-row">
            <div className="field"><label htmlFor="c-min">Minimum order (₹)</label><input id="c-min" inputMode="numeric" value={form.min_order} onChange={set('min_order')} /></div>
            <div className="field"><label htmlFor="c-lim">Usage limit (optional)</label><input id="c-lim" inputMode="numeric" value={form.usage_limit} onChange={set('usage_limit')} /></div>
          </div>
          <div className="field-row">
            <div className="field"><label htmlFor="c-start">Starts (optional)</label><input id="c-start" type="datetime-local" value={form.starts_at} onChange={set('starts_at')} /></div>
            <div className="field"><label htmlFor="c-end">Ends (optional)</label><input id="c-end" type="datetime-local" value={form.ends_at} onChange={set('ends_at')} /></div>
          </div>
          <label className="check"><input type="checkbox" checked={form.is_active} onChange={set('is_active')} /> Active</label>
          <div className="row-gap" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm">{editId ? 'Save coupon' : 'Create coupon'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setForm(null); setEditId(null); setError('') }}>Cancel</button>
          </div>
        </form>
      )}
      {!list ? <div className="skeleton-block" /> : (
        <ul className="coupon-list">
          {list.map((c) => {
            const expired = c.ends_at && new Date(c.ends_at) < new Date()
            return (
              <li key={c.id} className="card">
                <div>
                  <strong className="coupon-code">{c.code}</strong>
                  <span className={`pill ${c.is_active && !expired ? 'pill-green' : 'pill-red'}`}>{expired ? 'Expired' : c.is_active ? 'Active' : 'Off'}</span>
                  <p className="small">{c.discount_type === 'percent' ? `${c.value}% off${c.max_discount ? ` (up to ${rupees(c.max_discount)})` : ''}` : `${rupees(c.value)} off`}
                    {c.min_order ? ` · min ${rupees(c.min_order)}` : ''} · used {c.used_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}
                    {c.ends_at && ` · ends ${new Date(c.ends_at).toLocaleDateString('en-IN')}`}</p>
                </div>
                <div className="row-gap">
                  <button className="btn btn-outline btn-sm" onClick={() => edit(c)}>Edit</button>
                  <button className="btn btn-outline btn-sm danger" onClick={() => remove(c)}>Delete</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
