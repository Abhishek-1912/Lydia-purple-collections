import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { config, rupees, whatsappLink } from '../lib/config.js'
import { useStoreRules, useTitle } from '../lib/store.js'

export default function Policies() {
  useTitle('Shipping, payment & returns', 'Shipping charges, Cash on Delivery, returns and exchange, and privacy at Lydia Purple Collections.')
  const r = useStoreRules()
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  return (
    <section className="container page-narrow policies">
      <h1>Store policies</h1>
      <nav className="chips" aria-label="Policy sections">
        <a className="chip" href="#shipping">Shipping</a>
        <a className="chip" href="#payment">Payment & COD</a>
        <a className="chip" href="#cancellation">Cancellation</a>
        <a className="chip" href="#returns">Returns & exchange</a>
        <a className="chip" href="#privacy">Privacy</a>
      </nav>

      <h2 id="shipping">Shipping</h2>
      <ul>
        <li><strong>Free shipping</strong> on orders of {rupees(r.free_shipping_above)} or more (after any coupon).</li>
        <li>Orders below that: flat {rupees(r.shipping_fee)} anywhere in India.</li>
        <li>We pack and dispatch within 1–2 working days. Delivery usually takes 3–7 working days; remote areas (J&amp;K, North-East, islands) may take longer. Check your date on any product page.</li>
        <li>We send the courier name and tracking number by email and WhatsApp once your order ships. You can also see it in <Link to="/account">My account</Link>.</li>
        <li>We currently ship within India only.</li>
      </ul>

      <h2 id="payment">Payment &amp; Cash on Delivery</h2>
      <ul>
        <li>Pay online by UPI (GPay, PhonePe, Paytm, BHIM), debit/credit card or net banking — processed securely by Razorpay. We never see your card details.</li>
        <li><strong>Cash on Delivery</strong> is available on orders up to {rupees(r.cod_max_order)}, with a {rupees(r.cod_fee)} handling fee. Larger orders must be paid online.</li>
        <li>All prices are in Indian rupees and include GST.</li>
      </ul>

      <h2 id="cancellation">Cancellation</h2>
      <ul>
        <li>Cancel free of charge <strong>before your order is dispatched</strong> — message us on WhatsApp or email with your order number. Online payments are refunded in full within 5–7 working days.</li>
        <li>Once dispatched, an order can’t be cancelled. Refusing a Cash on Delivery parcel may stop Cash on Delivery on future orders.</li>
        <li>Full details in our <Link to="/terms#cancellation">Terms &amp; Conditions</Link>.</li>
      </ul>

      <h2 id="returns">Returns &amp; exchange</h2>
      <ul>
        <li>If your saree arrives damaged or is not what you ordered, message us on WhatsApp <strong>within 48 hours of delivery</strong> with an unboxing video and photos.</li>
        <li>Once we confirm the issue, we’ll arrange an exchange, or a refund to your original payment method (UPI/card) or bank account for COD orders, within 5–7 working days.</li>
        <li>Items must be unused, unwashed, with tags and the blouse piece intact.</li>
        <li>We can’t accept returns for colour differences due to screen settings, or on Clearance items unless damaged. Ask us for a live video before buying if you’re unsure.</li>
      </ul>

      <h2 id="privacy">Privacy</h2>
      <ul>
        <li>We collect your name, phone, email and address only to process and deliver your order, and to send you order updates.</li>
        <li>If you enter your mobile number at checkout but don’t finish the order, we keep your cart for up to 60 days and may send you one WhatsApp message to help you complete it.</li>
        <li>We count anonymous visits (which sarees are viewed, added to cart and ordered) to improve the shop. This uses a random browser ID — never your name, phone or email — and is skipped if your browser asks not to be tracked.</li>
        <li>We send offers on WhatsApp only if you tick “Send me new arrivals” at checkout. Reply STOP or message us anytime to stop.</li>
        <li>We never sell or rent your data. We share it only with our courier and payment partners as needed to complete your order.</li>
        <li>Your data is stored securely on servers in India.</li>
        <li>To see, change or delete your details, sign in to <Link to="/account">My account</Link> or contact us.</li>
      </ul>

      <div className="help-panel">
        <p>Questions about an order? {config.email && <>Email <a href={`mailto:${config.email}`}>{config.email}</a> or </>}chat with us.</p>
        <a className="btn btn-wa" href={whatsappLink('Hi! I have a question about your policies.')} target="_blank" rel="noreferrer">WhatsApp us</a>
      </div>
    </section>
  )
}
