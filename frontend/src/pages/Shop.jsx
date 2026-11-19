import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ProductGrid } from '../components/ProductCard.jsx'
import { api } from '../lib/api.js'
import { useTitle } from '../lib/store.js'

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
  const inStock = params.get('in_stock') === '1'
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
    if (inStock) qs.set('in_stock', 'true')
    if (q) qs.set('q', q)
    setLoading(true)
    setError('')
    api(`/api/products?${qs}`)
      .then(setProducts)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [info.filter, sort, inStock, q])

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
          <label className="check">
            <input type="checkbox" checked={inStock} onChange={(e) => update('in_stock', e.target.checked ? '1' : '')} />
            In stock only
          </label>
          <label className="select-label">
            <span className="sr-only">Sort by</span>
            <select value={sort} onChange={(e) => update('sort', e.target.value === 'featured' ? '' : e.target.value)}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error ? <p className="alert alert-error" role="alert">{error}</p> : (
        <>
          {!loading && <p className="muted small" aria-live="polite">{products.length} {products.length === 1 ? 'product' : 'products'}{q && ` for “${q}”`}</p>}
          <ProductGrid products={products} loading={loading}
            empty={q ? `Nothing matches “${q}”. Try another word, or ask us on WhatsApp.` : 'No products here yet.'} />
        </>
      )}
    </section>
  )
}
