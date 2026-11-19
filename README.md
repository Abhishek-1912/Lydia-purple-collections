# Lydia Purple Collections

Online store for silk sarees, blouses and ethnic wear, selling across India.
React (Vite) on **Vercel** · FastAPI on **Railway** · **Supabase** (Postgres, Auth, Storage) · **Razorpay** + Cash on Delivery · **Resend** email · WhatsApp Cloud API.

```
supabase/    schema.sql (fresh install), seed.sql (sample data), migrations/
backend/     FastAPI app (app/), tests/, Procfile
frontend/    React app (src/), public/ (sample import files), vercel.json
```

The server owns every price, total and stock decision. The browser only talks to the API (and to Supabase for sign-in).

---

## 1. Supabase

1. Create a project in region **Mumbai (ap-south-1)**.
2. SQL Editor → run `supabase/schema.sql`, then `supabase/seed.sql` (sample products — optional).
   *Existing project from before the product-details change? Run `supabase/migrations/001_product_details.sql`.*
3. Project Settings → API: copy **Project URL**, **anon key**, **service_role key**.
4. **Sign-in emails** — Authentication → Emails → SMTP Settings → enable custom SMTP (Resend):
   host `smtp.resend.com`, port `465`, user `resend`, password = Resend API key, sender = your Resend sender.
5. **Code instead of link** — Authentication → Emails → edit **Confirm signup** *and* **Magic Link**:
   ```html
   <h2>Your Lydia Purple sign-in code</h2>
   <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   <p>This code expires in 1 hour.</p>
   ```
   Sign In / Providers → Email → **Email OTP Length = 6**. (Sign-in also works with the link if a template still has one.)
6. Authentication → URL Configuration: **Site URL** = your live site (or `http://localhost:5173` while developing);
   **Redirect URLs** add `http://localhost:5173/**` and `https://<your-domain>/**`.

## 2. Run locally (two terminal tabs)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # fill in Supabase keys (see table below)
uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
npm install
cp .env.example .env      # Supabase URL + anon key, WhatsApp number, shop details
npm run dev               # http://localhost:5173
```

After editing `backend/.env`, restart uvicorn (`--reload` only watches code).

## 3. Make the owner an admin

Sign in once on the site with the owner's email, then in SQL Editor:
```sql
update profiles set role = 'admin' where email = 'owner@example.com';
```
Refresh — an **Admin** button appears. Admin lives at `/admin`.

## 4. Environment variables

**backend/.env** (Railway → Variables in production)

| Variable | What |
|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | From Supabase → API. Service key lives **only** here. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Blank = online payment hidden, COD only |
| `CORS_ORIGINS` | Comma-separated site URLs, e.g. `https://lydiapurple.in,https://www.lydiapurple.in` |
| `FREE_SHIPPING_ABOVE` `SHIPPING_FEE` `COD_FEE` `COD_MAX_ORDER` `PAYMENT_TIMEOUT_MINUTES` | Store rules (₹1999 / ₹99 / ₹49 / ₹15000 / 30 min) |
| `SHOP_PIN`, `DISPATCH_DAYS` | Shop's PIN and packing days, for delivery estimates |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SHOP_EMAIL` | Order and contact emails. Blank = off |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_ORDER`, `WHATSAPP_TEMPLATE_SHIPPED`, `SHOP_WHATSAPP` | WhatsApp alerts. Blank = off |

**frontend/.env** (Vercel → Environment Variables in production)

| Variable | What |
|---|---|
| `VITE_API_URL` | Railway URL, e.g. `https://lydia-api.up.railway.app` (no trailing slash) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | For sign-in only |
| `VITE_WHATSAPP_NUMBER` | Shop WhatsApp with country code, digits only: `919876543210` |
| `VITE_SHOP_PHONE` `VITE_SHOP_EMAIL` `VITE_SHOP_ADDRESS` `VITE_SHOP_HOURS` `VITE_INSTAGRAM` | Shown on Contact page and footer |

## 5. Deploy

### GitHub
```bash
git init && git add . && git commit -m "Lydia Purple Collections v1"
git branch -M main
git remote add origin https://github.com/<you>/lydia-purple-collections.git
git push -u origin main
```
`.env` files are git-ignored — never commit them.

### Railway (API)
1. New Project → Deploy from GitHub repo → pick the repo.
2. Service → Settings:
   - **Root Directory** = `backend` (Railpack reads `requirements.txt` and `.python-version` → Python 3.12)
   - **Region** = Southeast Asia (Singapore), closest to Supabase Mumbai
   - **Watch Paths** = `/backend/**`
   - **Start Command** = `uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips '*'`
   - **Healthcheck Path** = `/api/health`, Restart Policy = On Failure. Leave Serverless **off** (the unpaid-order expiry job must keep running).
3. Variables → add everything from `backend/.env`. Set `CORS_ORIGINS` to your Vercel URL (add the custom domain later).
4. Settings → Networking → **Generate Domain** (port 8080). Open `https://<railway-domain>/api/health` → `{"ok":true}`.

### Vercel (storefront)
1. Add New → Project → import the repo. **Root Directory** = `frontend` (framework: Vite, auto-detected).
2. Environment Variables → **Import .env** with a copy of `frontend/.env` where `VITE_API_URL` = the Railway URL
   (full `https://…`, no trailing slash). Local copies like `.env.vercel` are git-ignored.
3. Deploy. `vercel.json` sends every route to the React app, so `/products/...` links work on refresh.
4. Back in Railway, make sure `CORS_ORIGINS` contains the Vercel URL. In Supabase, add it to Site URL / Redirect URLs.

### Custom domain
Vercel → Project → Domains → add `lydiapurple.in` and `www.`, set the DNS records it shows at your registrar.
Then update `CORS_ORIGINS` (Railway) and Site URL / Redirect URLs (Supabase).

## 6. Razorpay

1. razorpay.com → **Test mode** → Settings → API Keys → generate. Put both keys in Railway variables (and local `.env`).
2. "Pay online" appears at checkout. Test UPI: `success@razorpay` (succeeds), `failure@razorpay` (fails).
3. Webhook: Settings → Webhooks → URL `https://<railway-domain>/api/webhooks/razorpay`,
   events **payment.captured** and **order.paid**, set a secret → `RAZORPAY_WEBHOOK_SECRET`.
   This confirms orders even if the shopper closes the browser after paying.
4. After KYC, switch to **Live mode**, generate live keys and a live webhook, replace the three variables.

Refunds are done in the Razorpay dashboard; then press **Mark refunded** on the order in admin.

## 7. Order alerts

Each channel is off until its keys are set; a failed message never blocks an order.

**Email (Resend)** — order confirmed (customer + shop), order shipped (customer), contact form (shop).
Until a domain is verified at resend.com/domains, `onboarding@resend.dev` only delivers to your own Resend account email.
After verifying: `EMAIL_FROM=Lydia Purple Collections <orders@yourdomain.in>` (update the Supabase SMTP sender too).

**WhatsApp (Meta Cloud API)** — create two *Utility* templates (English) in WhatsApp Manager:
- `order_confirmed`: *Hi {{1}}, thank you for shopping with Lydia Purple Collections! Your order {{2}} for {{3}} is confirmed ({{4}}). We'll message you when it ships.*
- `order_shipped`: *Hi {{1}}, your order {{2}} has been shipped via {{3}}. Tracking number: {{4}}. Thank you for shopping with Lydia Purple Collections!*

Set `WHATSAPP_TEMPLATE_ORDER=order_confirmed`, `WHATSAPP_TEMPLATE_SHIPPED=order_shipped`, plus token, phone number ID and `SHOP_WHATSAPP`.
The WhatsApp buttons on the site (order, notify me, live video) work without any of this.

## 8. Running the shop (admin)

- **Dashboard** — orders and sales today (IST), to pack, to ship, needs review, low stock (≤ 2).
- **Orders** — search by LPC number, phone or name. Add courier + tracking → Mark packed → shipped → delivered.
  Cancel returns stock. "Needs review" = paid after the order expired; check stock by hand, then Mark reviewed.
- **Products** — add/edit, variants (colour + size + stock), specifications, photos tagged by colour (JPG/PNG/WebP ≤ 5 MB).
  **Hide** removes a product from the shop without deleting it.
- **Bulk upload** — Products → Bulk upload. Download `sample-products.xlsx` (has a "How to fill" sheet). One row per colour/size;
  same name = same product. **Check file** first; nothing saves until **Import**. Re-importing a name updates price and stock.
  Photos: `image_urls` column (Google Drive links shared "Anyone with the link" work) or upload per product.
- **Coupons** — percent (with cap) or flat, minimum order, dates, usage limit. Codes are case-insensitive for shoppers.
- **Hidden categories** — Blouses starts hidden. To show it: `update categories set is_active = true where slug = 'blouses';`

## 9. Tests

```bash
cd backend && source .venv/bin/activate && pytest -q
```
Covers pricing, coupons, COD limit, shipping-after-discount, delivery estimates, Razorpay signatures, and alert safety.

## 10. Before launch checklist

- [ ] Real shop phone, WhatsApp, email, address, hours in `frontend` variables
- [ ] Final store rules (shipping fee, free-shipping threshold, COD fee/limit) and `SHOP_PIN`
- [ ] Return policy wording confirmed (48-hour window is a placeholder in `frontend/src/pages/Policies.jsx`)
- [ ] Domain verified in Resend; `EMAIL_FROM` and Supabase SMTP sender use it
- [ ] Razorpay live keys + live webhook; one real ₹1 test order paid and refunded
- [ ] End-to-end: one COD order (place → pack → ship with tracking → deliver) and one Razorpay test order
- [ ] Remove sample data:
  ```sql
  delete from orders;                         -- test orders (also removes their items)
  delete from products where slug in ('kanjivaram-temple-border','banarasi-meenakari','soft-silk-daily',
    'mysore-crepe-silk','organza-floral','bridal-red-kanjivaram','zari-work-blouse','chanderi-anarkali-kurti','festive-lehenga-set');
  alter table orders alter column order_no restart with 1001;
  ```
- [ ] Real products and photos loaded; Lighthouse mobile check on the live URL
