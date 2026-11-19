-- Saree add-ons (fall & edging, blouse stitching, shapewear) and blouse measurements.
-- Run once in Supabase → SQL Editor. Safe to re-run.
alter table order_items add column if not exists addons jsonb not null default '[]';   -- [{label, amount}] per unit; price already includes them
alter table orders      add column if not exists measurements jsonb;                   -- blouse measurements (inches), admin-only

create or replace function place_order(p_order jsonb, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid;
  v_no     bigint;
  v_method text    := p_order->>'payment_method';
  v_now    boolean := (p_order->>'payment_method') in ('cod','gift');
  v_coupon text    := nullif(p_order->>'coupon_code', '');
  v_gift   text    := nullif(p_order->>'gift_code', '');
  v_gamt   int     := coalesce((p_order->>'gift_amount')::int, 0);
  v_item   jsonb;
  v_rows   int;
begin
  insert into orders (user_id, customer_name, phone, email, address, subtotal, shipping_fee,
                      cod_fee, discount, total, coupon_code, coupon_counted, payment_method,
                      payment_status, status, gift_code, gift_amount, paid_at, measurements)
  values (nullif(p_order->>'user_id','')::uuid, p_order->>'customer_name', p_order->>'phone',
          nullif(p_order->>'email',''), p_order->'address',
          (p_order->>'subtotal')::int, (p_order->>'shipping_fee')::int, (p_order->>'cod_fee')::int,
          (p_order->>'discount')::int, (p_order->>'total')::int, v_coupon,
          v_now and v_coupon is not null, v_method,
          case v_method when 'cod' then 'cod_pending' when 'gift' then 'paid' else 'pending' end,
          case when v_now then 'confirmed' else 'pending_payment' end,
          v_gift, v_gamt,
          case when v_method = 'gift' then now() end,
          case when jsonb_typeof(p_order->'measurements') = 'object' then p_order->'measurements' end)
  returning id, order_no into v_id, v_no;

  for v_item in select * from jsonb_array_elements(p_items) loop
    update product_variants
       set stock = stock - (v_item->>'qty')::int
     where id = (v_item->>'variant_id')::uuid and stock >= (v_item->>'qty')::int;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'OUT_OF_STOCK:%', v_item->>'variant_id';
    end if;
    insert into order_items (order_id, product_id, variant_id, name, color, size, image_url, price, qty, addons)
    values (v_id, (v_item->>'product_id')::uuid, (v_item->>'variant_id')::uuid, v_item->>'name',
            v_item->>'color', v_item->>'size', v_item->>'image_url',
            (v_item->>'price')::int, (v_item->>'qty')::int, coalesce(v_item->'addons', '[]'::jsonb));
  end loop;

  if v_gift is not null and v_gamt > 0 then
    update gift_cards set balance = balance - v_gamt
     where code = v_gift and is_active and balance >= v_gamt and (expires_at is null or expires_at > now());
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'GIFT_LOW'; end if;
  end if;

  if v_now and v_coupon is not null then
    update coupons set used_count = used_count + 1
     where code = v_coupon and (usage_limit is null or used_count < usage_limit);
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'COUPON_LIMIT'; end if;
  end if;

  return jsonb_build_object('id', v_id, 'order_no', v_no);
end $$;

revoke all on function place_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function place_order(jsonb, jsonb) to service_role;
