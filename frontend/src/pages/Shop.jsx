import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ProductGrid } from '../components/ProductCard.jsx'
import { api } from '../lib/api.js'
import { useTitle } from '../lib/store.js'
import ShopFilters from '../components/ShopFilters.jsx'
import { activeCount, facets as buildFacets, passes, readFilters } from '../lib/filters.js'

const PRESETS = {
  bridal: { title: 'The Bridal Edit', filter: 'bridal=true', blurb: 'Heirloom silks for the wedding and every ritual around it.' },
  'new-arrivals': { title: 'New Arrivals', filter: 'new=true', blurb: 'Fresh from the looms this season.' },
  clearance: { title: 'Clearance', filter: 'clearance=true', blurb: 'Last pieces at their best prices.' },
  shop: { title: 'All Products', filter: '', blurb: 'Every saree and outfit in the boutique.' },
}

const SORTS = [
  ['featured', 'Featured'], ['newest', 'Newest'], ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'], ['discount', 'Biggest discount'],
]

export default function Shop({ preset }) {
  const { category } = useParams()
  const [params, setParams] = useSearchParams()
  const [cats, setCats] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState(params.get('q') || '')

  const sort = params.get('sort') || 'featured'
  const q = params.get('q') || ''

  useEffect(() => { api('/api/categories').then(setCats).catch(() => {}) }, [])

  const cat = cats.find((c) => c.slug === category)
  const info = category
    ? { title: cat?.name || 'Collection', filter: `category=${encodeURIComponent(category)}`, blurb: cat?.description }
    : PRESETS[preset || 'shop']
  useTitle(info.title, info.blurb)

  useEffect(() => {
    const qs = new URLSearchParams(info.filter)
    qs.set('sort', sort)
    if (q) qs.set('q', q)
    setLoading(true)
    setError('')
    api(`/api/products?${qs}`)
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [info.filter, sort, q])

  const [panel, setPanel] = useState(false)
  const filters = useMemo(() => readFilters(params), [params])
  const facets = useMemo(() => buildFacets(products, filters, cats), [products, filters, cats])
  const shown = useMemo(() => products.filter((p) => passes(p, filters)), [products, filters])
  const nActive = activeCount(filters)
  const closePanel = useCallback(() => setPanel(false), [])

  function toggle(key, id) {
    const next = new URLSearchParams(params)
    if (key === 'disc') {
      Number(id) === filters.disc ? next.delete('disc') : next.set('disc', id)
    } else {
      const cur = filters[key]
      const list = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      list.length ? next.set(key, list.join(',')) : next.delete(key)
    }
    setParams(next, { replace: true })
  }
  function clearFilters() {
    const next = new URLSearchParams()
    if (params.get('q')) next.set('q', params.get('q'))
    if (params.get('sort')) next.set('sort', params.get('sort'))
    setParams(next, { replace: true })
  }
  const chips = [
    ...filters.avail.map((v) => ['avail', v, v === 'in' ? 'In stock' : 'Sold out']),
    ...filters.price.map((v) => ['price', v, facets.price.find((o) => o.id === v)?.label || v]),
    ...(filters.disc ? [['disc', String(filters.disc), `${filters.disc}%+ off`]] : []),
    ...filters.type.map((v) => ['type', v, facets.type.find((o) => o.id === v)?.label || v]),
    ...filters.fabric.map((v) => ['fabric', v, v]),
    ...filters.colour.map((v) => ['colour', v, v]),
    ...filters.occ.map((v) => ['occ', v, v]),
  ]

  function update(key, value) {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <section className="container section">
      <header className="shop-head">
        <h1>{info.title}</h1>
        {info.blurb && <p className="display muted">{info.blurb}</p>}
      </header>

      <div className="toolbar">
        <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); update('q', search.trim()) }}>
          <label htmlFor="shop-search" className="sr-only">Search products</label>
          <input id="shop-search" type="search" placeholder="Search sarees, fabric, colour…" value={search}
            onChange={(e) => { setSearch(e.target.value); if (!e.target.value) update('q', '') }} />
          <button className="btn btn-primary btn-sm" type="submit">Search</button>
        </form>
        <div className="toolbar-row">
          <button type="button" className="btn btn-outline btn-sm filters-btn" onClick={() => setPanel(true)} aria-expanded={panel}>
            ☰ Filters{nActive > 0 && ` (${nActive})`}
          </button>
          <label className="select-label">
            <span className="sr-only">Sort by</span>
            <select value={sort} onChange={(e) => update('sort', e.target.value === 'featured' ? '' : e.target.value)}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error ? <p className="alert alert-error" role="alert">{error}</p> : (
        <div className="shop-layout">
          <ShopFilters facets={facets} filters={filters} onToggle={toggle} onClear={clearFilters} total={shown.length}
            hideType={!!category} open={panel} onClose={closePanel} />
          <div className="shop-results">
            {!loading && <p className="muted small" aria-live="polite">{shown.length} {shown.length === 1 ? 'product' : 'products'}{q && ` for “${q}”`}</p>}
            {chips.length > 0 && (
              <div className="fchips">
                {chips.map(([k, v, label]) => (
                  <button key={k + v} type="button" className="fchip" onClick={() => toggle(k, v)} aria-label={`Remove filter ${label}`}>{label} ✕</button>
                ))}
                <button type="button" className="link-btn" onClick={clearFilters}>Clear all</button>
              </div>
            )}
            <ProductGrid products={shown} loading={loading}
              empty={nActive ? 'No products match these filters. Try removing one.' : q ? `Nothing matches “${q}”. Try another word, or ask us on WhatsApp.` : 'No products here yet.'} />
          </div>
        </div>
      )}
    </section>
  )
}
