import { useEffect, useState } from 'react'
import { useAuthedApi } from '../../context/AuthContext.jsx'

const BLANK = { name: '', description: '', sort_order: 0, is_active: true }

export default function Categories() {
  const call = useAuthedApi()
  const [list, setList] = useState(null)
  const [form, setForm] = useState(null)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const load = () => call('/api/admin/categories/all').then(setList).catch((e) => setError(e.message))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e) {
    e.preventDefault(); setError('')
    try {
      const body = { ...form, sort_order: parseInt(form.sort_order, 10) || 0, description: form.description || null }
      await call(editId ? `/api/admin/categories/${editId}` : '/api/admin/categories', { method: editId ? 'PUT' : 'POST', body })
      setForm(null); setEditId(null); load()
    } catch (err) { setError(err.message) }
  }
  async function toggle(c) {
    await call(`/api/admin/categories/${c.id}`, { method: 'PUT', body: { name: c.name, description: c.description, sort_order: c.sort_order, is_active: !c.is_active } })
    load()
  }
  async function remove(c) {
    if (!window.confirm(`Delete the category “${c.name}”?`)) return
    try { await call(`/api/admin/categories/${c.id}`, { method: 'DELETE' }); load() } catch (err) { setError(err.message) }
  }

  return (
    <>
      <div className="admin-title-row">
        <h1 className="admin-h">Categories</h1>
        {!form && <button className="btn btn-primary btn-sm" onClick={() => { setForm(BLANK); setEditId(null) }}>+ New category</button>}
      </div>
      <p className="small muted">Hidden categories (and their products) don’t appear in the shop. The web address of a category stays the same when you rename it.</p>
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {form && (
        <form className="card" onSubmit={save} noValidate>
          <div className="field-row">
            <div className="field"><label htmlFor="cat-name">Name</label><input id="cat-name" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lehengas" /></div>
            <div className="field"><label htmlFor="cat-sort">Order in menu (1 = first)</label><input id="cat-sort" inputMode="numeric" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value.replace(/\D/g, '') })} /></div>
          </div>
          <div className="field"><label htmlFor="cat-desc">Short description (shown on the category tile)</label><input id="cat-desc" type="text" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <label className="check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Show in shop</label>
          <div className="row-gap" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-sm">{editId ? 'Save' : 'Create'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setForm(null); setEditId(null) }}>Cancel</button>
          </div>
        </form>
      )}
      {!list ? <div className="skeleton-block" /> : (
        <ul className="coupon-list">
          {list.map((c) => (
            <li key={c.id} className="card">
              <div>
                <strong>{c.name}</strong> <span className={`pill ${c.is_active ? 'pill-green' : 'pill-red'}`}>{c.is_active ? 'Shown' : 'Hidden'}</span>
                <p className="small muted">/collections/{c.slug} · {c.products} product{c.products === 1 ? '' : 's'} · order {c.sort_order}{c.description ? ` · ${c.description}` : ''}</p>
              </div>
              <div className="row-gap">
                <button className="btn btn-outline btn-sm" onClick={() => toggle(c)}>{c.is_active ? 'Hide' : 'Show'}</button>
                <button className="btn btn-outline btn-sm" onClick={() => { setEditId(c.id); setForm({ name: c.name, description: c.description || '', sort_order: c.sort_order, is_active: c.is_active }) }}>Edit</button>
                <button className="btn btn-outline btn-sm danger" onClick={() => remove(c)} disabled={c.products > 0} title={c.products ? 'Has products' : ''}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
