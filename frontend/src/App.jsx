import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Home from './pages/Home.jsx'
import Shop from './pages/Shop.jsx'
import Product from './pages/Product.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import OrderConfirmation from './pages/OrderConfirmation.jsx'
import Login from './pages/Login.jsx'
import Account from './pages/Account.jsx'
import Contact from './pages/Contact.jsx'
import Policies from './pages/Policies.jsx'
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard.jsx'))
const AdminOrders = lazy(() => import('./pages/admin/Orders.jsx'))
const AdminProducts = lazy(() => import('./pages/admin/Products.jsx'))
const ProductForm = lazy(() => import('./pages/admin/ProductForm.jsx'))
const Coupons = lazy(() => import('./pages/admin/Coupons.jsx'))
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <Suspense fallback={<section className="container section"><div className="skeleton-block" /></section>}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop preset="shop" />} />
        <Route path="collections/:category" element={<Shop />} />
        <Route path="bridal" element={<Shop preset="bridal" />} />
        <Route path="new-arrivals" element={<Shop preset="new-arrivals" />} />
        <Route path="clearance" element={<Shop preset="clearance" />} />
        <Route path="products/:slug" element={<Product />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="order/:id" element={<OrderConfirmation />} />
        <Route path="login" element={<Login />} />
        <Route path="account" element={<Account />} />
        <Route path="contact" element={<Contact />} />
        <Route path="policies" element={<Policies />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/:id" element={<ProductForm />} />
          <Route path="coupons" element={<Coupons />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
  )
}
