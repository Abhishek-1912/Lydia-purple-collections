-- v2 + v3 features: reviews, wishlist, abandoned checkouts, GST invoices, packer role,
-- video-call bookings, gift cards, analytics events, courier & refund fields.
-- Run once in Supabase → SQL Editor. Safe to re-run.

-- ───────── Reviews (shown only after admin approval) ─────────
create table if not exists reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products on delete cascade,
  user_id     uuid references auth.users on delete set null,
  order_id    uuid references orders on delete set null,      -- set when the reviewer bought it (verified buyer)
  name        text not null,
  rating      int  not null check (rating between 1 and 5),
  title       text,
  body        text,
  photos      jsonb not null default '[]',
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  reply       text,                                         -- shop's public reply
  created_at  timestamptz not null default now()
);
create index if not exists reviews_product_idx on reviews (product_id, status);

-- ───────── Wishlist (signed-in customers; guests keep theirs in the browser) ─────────
create table if not exists wishlists (
  user_id     uuid not null references auth.users on delete cascade,
  product_id  uuid not null references products on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ───────── Abandoned checkouts ─────────
create table if not exists checkout_drafts (
  id               uuid primary key default gen_random_uuid(),
  session_id       text not null unique,
  user_id          uuid references auth.users on delete set null,
  name             text,
  phone            text,
  email            text,
  items            jsonb not null default '[]',
  subtotal         int not null default 0,
  order_id         uuid references orders on delete set null,   -- set when they complete the order
  contacted_at     timestamptz,                                 -- owner sent a WhatsApp reminder
  auto_reminded_at timestamptz,                                 -- automatic reminder (when WhatsApp keys are set)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists drafts_updated_idx on checkout_drafts (updated_at);

-- ───────── GST invoices ─────────
create sequence if not exists invoice_seq start 1;
alter table orders add column if not exists invoice_no   int unique;
alter table orders add column if not exists invoice_date timestamptz;

-- ───────── Packer staff role ─────────
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('customer','admin','packer'));

-- ───────── Bridal video-call bookings ─────────
create table if not exists video_calls (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  email       text,
  slot        timestamptz not null,
  product_id  uuid references products on delete set null,
  note        text,
  status      text not null default 'requested' check (status in ('requested','confirmed','done','cancelled')),
  link        text,                                   -- video link the shop sends (Meet / WhatsApp)
  created_at  timestamptz not null default now()
);
create unique index if not exists video_calls_slot_active on video_calls (slot) where status in ('requested','confirmed');

-- ───────── Gift cards / store credit ─────────
create table if not exists gift_cards (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code = upper(code)),
  initial_value int  not null check (initial_value > 0),
  balance       int  not null check (balance >= 0),
  issued_to     text,
  phone         text,
  note          text,
  expires_at    timestamptz,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table orders add column if not exists gift_code     text;
alter table orders add column if not exists gift_amount   int not null default 0;
alter table orders add column if not exists gift_restored boolean not null default false;
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add constraint orders_payment_method_check check (payment_method in ('razorpay','cod','gift'));

-- ───────── Analytics events (anonymous; no personal data) ─────────
create table if not exists events (
  id          bigserial primary key,
  session_id  text not null,
  type        text not null check (type in ('view','cart','checkout','order')),
  product_id  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists events_created_idx on events (created_at);

-- ───────── Courier (Shiprocket) & refunds — used when keys are added ─────────
alter table orders add column if not exists shipment_id    text;
alter table orders add column if not exists courier_status text;
alter table orders add column if not exists refund_id      text;
alter table orders add column if not exists refund_amount  int;

-- ───────── place_order: now also redeems gift cards in the same transaction ─────────
create or replace function place_order(p_order jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid;
  v_no     bigint;
  v_method text    := p_order->>'payment_method';
  v_now    boolean := (p_order->>'payment_method') in ('cod','gift');   -- confirmed immediately
  v_coupon text    := nullif(p_order->>'coupon_code', '');
  v_gift   text    := nullif(p_order->>'gift_code', '');
  v_gamt   int     := coalesce((p_order->>'gift_amount')::int, 0);
  v_item   jsonb;
  v_rows   int;
begin
  insert into orders (user_id, customer_name, phone, email, address, subtotal, shipping_fee,
                      cod_fee, discount, total, coupon_code, coupon_counted, payment_method,
                      payment_status, status, gift_code, gift_amount, paid_at)
  values (nullif(p_order->>'user_id','')::uuid, p_order->>'customer_name', p_order->>'phone',
          nullif(p_order->>'email',''), p_order->'address',
          (p_order->>'subtotal')::int, (p_order->>'shipping_fee')::int, (p_order->>'cod_fee')::int,
          (p_order->>'discount')::int, (p_order->>'total')::int, v_coupon,
          v_now and v_coupon is not null, v_method,
          case v_method when 'cod' then 'cod_pending' when 'gift' then 'paid' else 'pending' end,
          case when v_now then 'confirmed' else 'pending_payment' end,
          v_gift, v_gamt,
          case when v_method = 'gift' then now() end)
  returning id, order_no into v_id, v_no;

  for v_item in select * from jsonb_array_elements(p_items) loop
    update product_variants
       set stock = stock - (v_item->>'qty')::int
     where id = (v_item->>'variant_id')::uuid and stock >= (v_item->>'qty')::int;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'OUT_OF_STOCK:%', v_item->>'variant_id';
    end if;
    insert into order_items (order_id, product_id, variant_id, name, color, size, image_url, price, qty)
    values (v_id, (v_item->>'product_id')::uuid, (v_item->>'variant_id')::uuid, v_item->>'name',
            v_item->>'color', v_item->>'size', v_item->>'image_url',
            (v_item->>'price')::int, (v_item->>'qty')::int);
  end loop;

  -- Gift card: take the amount now (online orders get it back if payment never completes)
  if v_gift is not null and v_gamt > 0 then
    update gift_cards set balance = balance - v_gamt
     where code = v_gift and is_active and balance >= v_gamt and (expires_at is null or expires_at > now());
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'GIFT_LOW'; end if;
  end if;

  -- Coupon usage counted at placement for COD / fully-gift-paid orders (online: at payment)
  if v_now and v_coupon is not null then
    update coupons set used_count = used_count + 1
     where code = v_coupon and (usage_limit is null or used_count < usage_limit);
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'COUPON_LIMIT'; end if;
  end if;

  return jsonb_build_object('id', v_id, 'order_no', v_no);
end $$;

-- release_order_stock: stock back once, and the gift-card amount back once
create or replace function release_order_stock(p_order_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update orders set stock_released = true
   where id = p_order_id and not stock_released
  returning id into v_id;
  if v_id is null then return false; end if;

  update product_variants v
     set stock = v.stock + s.qty
    from (select variant_id, sum(qty)::int as qty from order_items
           where order_id = p_order_id and variant_id is not null group by variant_id) s
   where v.id = s.variant_id;

  update gift_cards g set balance = g.balance + o.gift_amount
    from orders o
   where o.id = p_order_id and o.gift_code = g.code and o.gift_amount > 0 and not o.gift_restored;
  update orders set gift_restored = true where id = p_order_id and gift_amount > 0;
  return true;
end $$;

-- next invoice number (atomic)
create or replace function next_invoice(p_order_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  select invoice_no into v from orders where id = p_order_id for update;
  if v is not null then return v; end if;
  v := nextval('invoice_seq');
  update orders set invoice_no = v, invoice_date = now() where id = p_order_id;
  return v;
end $$;

revoke all on function place_order(jsonb, jsonb)   from public, anon, authenticated;
revoke all on function release_order_stock(uuid)   from public, anon, authenticated;
revoke all on function next_invoice(uuid)          from public, anon, authenticated;
grant execute on function place_order(jsonb, jsonb) to service_role;
grant execute on function release_order_stock(uuid) to service_role;
grant execute on function next_invoice(uuid)        to service_role;

-- ───────── Security: new tables are API-only (service key) ─────────
alter table reviews         enable row level security;
alter table wishlists       enable row level security;
alter table checkout_drafts enable row level security;
alter table video_calls     enable row level security;
alter table gift_cards      enable row level security;
alter table events          enable row level security;
grant all on reviews, wishlists, checkout_drafts, video_calls, gift_cards, events to service_role;
grant usage, select on all sequences in schema public to service_role;
