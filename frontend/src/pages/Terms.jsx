import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { config, rupees, SHOP_NAME } from '../lib/config.js'
import { useStoreRules, useTitle } from '../lib/store.js'

export default function Terms() {
  useTitle('Terms & Conditions', `Terms of use and sale for ${SHOP_NAME}.`)
  const r = useStoreRules()
  const { hash } = useLocation()
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView() }, [hash])
  return (
    <section className="container page-narrow policies">
      <h1>Terms &amp; Conditions</h1>
      <p className="small muted">Last updated: {new Date().getFullYear()}</p>
      <p>
        This website is operated by <strong>{SHOP_NAME}</strong>{config.address && <>, {config.address}</>}.
        By browsing or placing an order you agree to these terms. Please also read our{' '}
        <Link to="/policies">Shipping, Payment, Returns and Privacy policies</Link>, which form part of these terms.
      </p>

      <h2>1. Products and prices</h2>
      <ul>
        <li>All prices are in Indian rupees (₹) and include GST. Shipping and any Cash on Delivery fee are shown at checkout before you pay.</li>
        <li>Silk and handloom products are made by hand; small variations in weave, colour and motif are natural and not defects. Colours may look slightly different on screens.</li>
        <li>We try to keep prices and stock accurate. If an error happens, we will contact you and you may cancel for a full refund.</li>
      </ul>

      <h2>2. Orders</h2>
      <ul>
        <li>An order is confirmed when you receive an order number (e.g. LPC1001) — after successful online payment, or immediately for Cash on Delivery.</li>
        <li>Unpaid online orders are cancelled automatically after {r.payment_timeout_minutes || 30} minutes and the items go back on sale.</li>
        <li>We may cancel an order (with a full refund of anything paid) if an item is out of stock, the address can’t be served, or the order looks fraudulent or abusive.</li>
        <li>Cash on Delivery is available up to {rupees(r.cod_max_order)} per order. We may decline Cash on Delivery for numbers with previously refused deliveries.</li>
      </ul>

      <h2 id="cancellation">3. Cancellation &amp; refunds</h2>
      <ul>
        <li><strong>Before dispatch:</strong> you can cancel free of charge — message us on WhatsApp or email with your order number. Online payments are refunded in full to the original payment method within 5–7 working days.</li>
        <li><strong>After dispatch:</strong> orders can’t be cancelled. If you refuse a Cash on Delivery parcel, we may decline Cash on Delivery on your future orders.</li>
        <li><strong>Damaged or wrong item:</strong> see <Link to="/policies#returns">Returns &amp; exchange</Link> — report within 48 hours of delivery with an unboxing video.</li>
        <li>Refunds for Cash on Delivery orders are paid by UPI or bank transfer to an account you give us.</li>
      </ul>

      <h2>4. Payments</h2>
      <ul>
        <li>Online payments are processed by Razorpay. We do not see or store your card, UPI PIN or bank details.</li>
        <li>If money was deducted but you didn’t get an order number, contact us — we will confirm the order or the bank will reverse it automatically.</li>
      </ul>

      <h2>5. Your account</h2>
      <ul>
        <li>You sign in with a one-time code sent to your email. Keep access to your email secure; you are responsible for orders placed from your account.</li>
        <li>Please give a correct name, phone number and full address so we can deliver.</li>
      </ul>

      <h2>6. Use of the website</h2>
      <ul>
        <li>Photos, text and designs on this website belong to {SHOP_NAME} and may not be copied for commercial use without permission.</li>
        <li>Don’t misuse the website — for example by placing fake orders or trying to break its security.</li>
      </ul>

      <h2>7. Liability</h2>
      <p>Our liability for any order is limited to the amount you paid for it. We are not responsible for courier delays beyond our control, but we will help you follow up.</p>

      <h2>8. Governing law</h2>
      <p>These terms are governed by the laws of India. Any dispute is subject to the courts where {SHOP_NAME} is located.</p>

      <h2>9. Contact</h2>
      <p>
        {config.email && <>Email <a href={`mailto:${config.email}`}>{config.email}</a>. </>}
        {config.phone && <>Phone <a href={`tel:${config.phone.replace(/\s/g, '')}`}>{config.phone}</a>. </>}
        Or use our <Link to="/contact">contact page</Link>.
      </p>
    </section>
  )
}
