import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProductGrid } from '../components/ProductCard.jsx'
import { HeartIcon } from '../components/WishButton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useWishlist } from '../context/WishlistContext.jsx'
import { api } from '../lib/api.js'
import { useTitle } from '../lib/store.js'

export default function Wishlist() {
  useTitle('My wishlist')
  const { ids } = useWishlist()
  const { user } = useAuth()
  const [all, setAll] = useState(null)
  useEffect(() => { api('/api/products').then(setAll).catch(() => setAll([])) }, [])
  const products = (all || []).filter((p) => ids.includes(p.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))

  return (
    <section className="container section">
      <h1>My wishlist</h1>
      {!user && ids.length > 0 && <p className="small muted"><Link to="/login?next=/wishlist" className="link-gold">Sign in</Link> to keep your wishlist on all your devices.</p>}
      {all && !products.length ? (
        <div className="empty-state">
          <span className="empty-icon"><HeartIcon size={34} /></span>
          <p className="display">Nothing saved yet.</p>
          <p className="muted">Tap the ♡ on any saree to save it here for later.</p>
          <Link to="/shop" className="btn btn-primary">Browse sarees</Link>
        </div>
      ) : <ProductGrid products={products} loading={!all} />}
    </section>
  )
}
