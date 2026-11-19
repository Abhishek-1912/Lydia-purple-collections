import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductImage from '../../components/ProductImage.jsx'
import { useAuthedApi } from '../../context/AuthContext.jsx'
import { rupees } from '../../lib/config.js'

function ImportPanel({ onDone }) {
  const call = useAuthedApi()
  const [file, setFile] = useState(null)
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send(dryRun) {
    if (!file) return
    setBusy(true); setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('dry_run', dryRun ? 'true' : 'false')
    try {
      const r = await call('/api/admin/products/import', { method: 'POST', body: fd })
      setReport(r)
      if (!dryRun && !r.dry_run) onDone()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  const imported = report && !report.dry_run
  return (
    <div className="card import">
      <h2 className="admin-h2">Bulk upload from Excel or CSV</h2>
      <ol className="small steps">
        <li>Download the sample: <a href="/sample-products.xlsx" download>Excel (.xlsx)</a> or <a href="/sample-products.csv" download>CSV</a>. The Excel file has a “How to fill” sheet.</li>
        <li>One row per colour/size. Repeat the product name for each row of the same product.</li>
        <li>Photos: paste links in <code>image_urls</code> (Google Drive “Anyone with the link” works), or leave blank and add photos on each product later.</li>
        <li>Click <strong>Check file</strong> first. Nothing is saved until you click <strong>Import</strong>.</li>
      </ol>
      <div className="import-row">
        <label className="sr-only" htmlFor="import-file">Choose file</label>
        <input id="import-file" type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files[0] || null); setReport(null) }} />
        <button className="btn btn-outline btn-sm" disabled={!file || busy} onClick={() => send(true)}>{busy ? 'Working…' : 'Check file'}</button>
        <button className="btn btn-primary btn-sm" disabled={!report || report.errors.length > 0 || imported || busy} onClick={() => send(false)}>Import</button>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      {report && (
        <div className="report">
          {report.errors.length > 0 ? (
            <>
              <p className="alert alert-error">Fix these rows and upload again (nothing was saved):</p>
              <ul className="plain small">{report.errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul>
            </>
          ) : (
            <p className={`alert ${imported ? 'alert-ok' : ''}`}>
              {imported ? 'Imported!' : 'File looks good.'} {report.created} new, {report.updated} updated.
              {!imported && ' Click Import to save.'}
            </p>
          )}
          <ul className="plain small">{report.products.map((p) => <li key={p.name}>{p.action === 'create' ? '➕' : '✏️'} {p.name} — {p.variants} variant(s){p.photos ? `, ${p.photos} photo(s)` : ''}</li>)}</ul>
          {report.photo_errors?.length > 0 && <><p className="small line-error">Some photos couldn’t be added:</p><ul className="plain small">{report.photo_errors.map((m, i) => <li key={i}>{m}</li>)}</ul></>}
        </div>
      )}
    </div>
  )
}

function PhotoPanel({ onDone }) {
  const call = useAuthedApi()
  const [results, setResults] = useState([])
  const [progress, setProgress] = useState(null)

  async function upload(e) {
    const files = [...e.target.files]
    e.target.value = ''
    setResults([])
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      setProgress({ done: i, total: files.length })
      let r
      if (f.size > 5 * 1024 * 1024) r = { file: f.name, error: 'Larger than 5 MB — please compress it.' }
      else {
        const fd = new FormData()
        fd.append('file', f, f.name)
        try { r = await call('/api/admin/images/by-sku', { method: 'POST', body: fd }) } catch (err) { r = { file: f.name, error: err.message } }
      }
      setResults((all) => [...all, r])
    }
    setProgress(null)
    onDone()
  }

  const ok = results.filter((r) => !r.error).length
  return (
    <div className="card import">
      <h2 className="admin-h2">Upload photos by file name</h2>
      <ol className="small steps">
        <li>Import your products first (each colour row needs a <strong>SKU</strong>).</li>
        <li>Name each photo with its SKU, and add -1, -2, -3 for more photos: <code>KAN-TB-PURPLE-1.jpg</code>, <code>KAN-TB-PURPLE-2.jpg</code>.</li>
        <li>For sizes (blouses, kurtis) use any one size’s SKU — the photo is shown for that colour: <code>BLS-ZARI-GOLD-S-1.jpg</code>.</li>
        <li>JPG, PNG or WebP, up to 5 MB each. The <strong>-1</strong> photo of the first colour becomes the main photo.</li>
      </ol>
      <label className="btn btn-primary btn-sm file-btn">
        {progress ? `Uploading ${progress.done + 1} of ${progress.total}…` : 'Choose photos'}
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={upload} className="sr-only" disabled={!!progress} />
      </label>
      {results.length > 0 && (
        <div className="report">
          <p className={`alert ${ok === results.length ? 'alert-ok' : 'alert-error'}`}>{ok} of {results.length} photos added.</p>
          <ul className="plain small">
            {results.map((r, i) => <li key={i}>{r.error ? `❌ ${r.error}` : `✅ ${r.file} → ${r.product}${r.color ? ` (${r.color})` : ''}`}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function QuickEdit({ p, onSaved, onClose }) {
  const call = useAuthedApi()
  const [price, setPrice] = useState(String(p.price))
  const [mrp, setMrp] = useState(p.mrp ? String(p.mrp) : '')
  const [stock, setStock] = useState(() => Object.fromEntries(p.variants.map((v) => [v.id, String(v.stock)])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true); setError('')
    try {
      const updated = await call(`/api/admin/products/${p.id}/quick`, { method: 'PATCH', body: {
        price: parseInt(price, 10) || null, mrp: mrp === '' ? 0 : parseInt(mrp, 10),
        variants: p.variants.map((v) => ({ id: v.id, stock: parseInt(stock[v.id], 10) || 0 })),
      } })
      onSaved(updated)
      onClose()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <div className="quick">
      <div className="quick-row">
        <label>Price ₹<input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} /></label>
        <label>MRP ₹<input inputMode="numeric" value={mrp} placeholder="none" onChange={(e) => setMrp(e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      <div className="quick-variants">
        {p.variants.map((v) => (
          <label key={v.id}>
            <span>{[v.color, v.size].filter(Boolean).join(' / ') || 'Stock'}{v.sku && <small> · {v.sku}</small>}</span>
            <input inputMode="numeric" value={stock[v.id]} onChange={(e) => setStock({ ...stock, [v.id]: e.target.value.replace(/\D/g, '') })} aria-label={`Stock for ${v.color} ${v.size}`} />
          </label>
        ))}
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      <div className="row-gap">
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

export default function Products() {
  const call = useAuthedApi()
  const [items, setItems] = useState(null)
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [showPhotos, setShowPhotos] = useState(false)
  const [quickId, setQuickId] = useState(null)
  const [error, setError] = useState('')

  const load = () => call(`/api/admin/products?status=${status}`).then(setItems).catch((e) => setError(e.message))
  useEffect(() => { setItems(null); load() }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(p) {
    const updated = await call(`/api/admin/products/${p.id}`, { method: 'PATCH', body: { is_active: !p.is_active } })
    setItems((all) => all.map((x) => x.id === p.id ? updated : x))
  }

  const t = q.trim().toLowerCase()
  const shown = (items || []).filter((p) => !t || p.name.toLowerCase().includes(t) || p.variants.some((v) => (v.sku || '').toLowerCase().includes(t)))

  return (
    <>
      <div className="admin-title-row">
        <h1 className="admin-h">Products</h1>
        <div className="row-gap">
          <button className="btn btn-outline btn-sm" onClick={() => { setShowImport(!showImport); setShowPhotos(false) }}>{showImport ? 'Close upload' : 'Bulk upload'}</button>
          <button className="btn btn-outline btn-sm" onClick={() => { setShowPhotos(!showPhotos); setShowImport(false) }}>{showPhotos ? 'Close photos' : 'Bulk photos'}</button>
          <Link to="/admin/products/new" className="btn btn-primary btn-sm">+ Add product</Link>
        </div>
      </div>
      {showImport && <ImportPanel onDone={load} />}
      {showPhotos && <PhotoPanel onDone={load} />}
      <div className="toolbar">
        <div className="search">
          <label htmlFor="pq" className="sr-only">Search products</label>
          <input id="pq" type="search" placeholder="Search name or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips">
          {[['all', 'All'], ['live', 'Live'], ['hidden', 'Hidden']].map(([v, l]) => <button key={v} className={`chip ${status === v ? 'active' : ''}`} onClick={() => setStatus(v)}>{l}</button>)}
        </div>
      </div>
      {error && <p className="alert alert-error">{error}</p>}
      {!items ? <div className="skeleton-block" /> : (
        <ul className="admin-products">
          {shown.map((p) => (
            <li key={p.id} className={p.is_active ? '' : 'is-hidden'}>
              <Link to={`/admin/products/${p.id}`} className="ap-thumb"><ProductImage src={p.images[0]?.url} alt="" hex={p.colors[0]?.hex} /></Link>
              <div className="ap-info">
                <Link to={`/admin/products/${p.id}`} className="ap-name">{p.name}</Link>
                <p className="small muted">{p.category?.name || 'No category'} · {rupees(p.price)}{p.mrp > p.price && <s> {rupees(p.mrp)}</s>}</p>
                <p className="small">
                  <span className={`pill ${p.total_stock === 0 ? 'pill-red' : p.total_stock <= 2 ? 'pill-amber' : 'pill-green'}`}>{p.total_stock} in stock</span>
                  {p.is_new && <span className="pill">New</span>}{p.is_bridal && <span className="pill">Bridal</span>}{p.is_clearance && <span className="pill">Clearance</span>}
                  {!p.is_active && <span className="pill pill-red">Hidden</span>}
                </p>
              </div>
              <div className="ap-actions">
                <button className="btn btn-outline btn-sm" onClick={() => setQuickId(quickId === p.id ? null : p.id)} aria-expanded={quickId === p.id}>Stock / price</button>
                <button className="btn btn-outline btn-sm" onClick={() => toggle(p)}>{p.is_active ? 'Hide' : 'Show'}</button>
              </div>
              {quickId === p.id && <QuickEdit p={p} onClose={() => setQuickId(null)} onSaved={(u) => setItems((all) => all.map((x) => x.id === u.id ? u : x))} />}
            </li>
          ))}
          {!shown.length && <p className="muted">No products found.</p>}
        </ul>
      )}
    </>
  )
}
