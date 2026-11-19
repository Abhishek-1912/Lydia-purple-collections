import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { useTitle } from '../../lib/store.js'

export default function AdminLayout() {
  useTitle('Admin')
  const { user, isAdmin, loading, profile } = useAuth()
  const loc = useLocation()
  if (loading || (user && !profile)) return <section className="container section"><div className="skeleton-block" /></section>
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  if (!isAdmin) {
    return (
      <section className="container page-narrow center">
        <h1>Admins only</h1>
        <p className="muted">You’re signed in as {user.email}, which isn’t an admin account.</p>
      </section>
    )
  }
  return (
    <div className="admin">
      <nav className="admin-nav" aria-label="Admin">
        <div className="container">
          <NavLink to="/admin/add" className="nav-add">➕ Add product</NavLink>
          <NavLink to="/admin" end>Dashboard</NavLink>
          <NavLink to="/admin/orders">Orders</NavLink>
          <NavLink to="/admin/products">Products</NavLink>
          <NavLink to="/admin/customers">Customers</NavLink>
          <NavLink to="/admin/reviews">Reviews</NavLink>
          <NavLink to="/admin/coupons">Coupons</NavLink>
          <NavLink to="/admin/categories">Categories</NavLink>
          <NavLink to="/admin/settings">Settings</NavLink>
          <NavLink to="/admin/staff">Staff</NavLink>
        </div>
      </nav>
      <div className="container admin-body"><Outlet /></div>
    </div>
  )
}
