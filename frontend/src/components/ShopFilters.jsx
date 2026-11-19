import { useEffect } from 'react'
import { swatchBg } from '../lib/shades.js'

const GROUPS = [
  { key: 'avail', label: 'Availability' },
  { key: 'price', label: 'Price' },
  { key: 'disc', label: 'Discount', single: true },
  { key: 'type', label: 'Product type' },
  { key: 'fabric', label: 'Fabric' },
  { key: 'colour', label: 'Colour' },
  { key: 'occ', label: 'Occasion' },
]

// Accordion filters. Desktop: left sidebar. Phone: full-screen panel (open/onClose).
export default function ShopFilters({ facets, filters, onToggle, onClear, total, hideType, open, onClose }) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const esc = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', esc) }
  }, [open, onClose])

  const selected = (key, id) => (key === 'disc' ? filters.disc === Number(id) : filters[key].includes(id))
  const groups = GROUPS.filter((g) => !(g.key === 'type' && (hideType || facets.type.length < 2)) && facets[g.key].length > 0)

  return (
    <aside className={`filters ${open ? 'open' : ''}`} aria-label="Filter products">
      <div className="filters-head">
        <strong>Filter by</strong>
        <button type="button" className="link-btn" onClick={onClear}>Clear all</button>
        <button type="button" className="filters-close" onClick={onClose} aria-label="Close filters">✕</button>
      </div>
      {groups.map((g) => {
        const chosen = facets[g.key].filter((o) => selected(g.key, o.id)).length
        return (
          <details key={g.key} className="fgroup" open={chosen > 0 || ['avail', 'price', 'fabric'].includes(g.key)}>
            <summary>{g.label}{chosen > 0 && <span className="fbadge">{chosen}</span>}</summary>
            <ul>
              {facets[g.key].map((o) => (
                <li key={o.id}>
                  <label className={`fopt ${!o.n && !selected(g.key, o.id) ? 'empty' : ''}`}>
                    <input type={g.single ? 'radio' : 'checkbox'} name={`f-${g.key}`} checked={selected(g.key, o.id)}
                      onChange={() => onToggle(g.key, o.id)} onClick={(e) => { if (g.single && selected(g.key, o.id)) { e.preventDefault(); onToggle(g.key, o.id) } }} />
                    {o.hex && <span className="dot xs" style={{ background: swatchBg(o.hex) }} />}
                    <span className="grow">{o.label}</span>
                    <span className="fcount">{o.n}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        )
      })}
      <div className="filters-foot">
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>Show {total} product{total === 1 ? '' : 's'}</button>
      </div>
    </aside>
  )
}
