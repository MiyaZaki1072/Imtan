-- V2 Phase 13 (PLAN-V2.md D1–D3): dishes per 5-minute pre-order slot, and a per-order dish
-- limit for app orders. Additive only: V1 screens keep working with the defaults.

alter default privileges revoke execute on functions from public;

alter table public.shops
  add column preorder_dishes_per_slot integer not null default 6
    check (preorder_dishes_per_slot between 1 and 50),
  add column max_dishes_per_order integer not null default 10
    check (max_dishes_per_order between 1 and 50);

-- Same signature as before, so existing grants stay. New: an app pre-order fails with
-- 'slot_full' when its pickup slot already holds the shop's dish capacity. Unpaid orders
-- hold their space until they expire (D3); abandoned/expired ones free it by status.
create or replace function public.insert_order(
  p_shop_id uuid,
  p_customer_id uuid,
  p_customer_name text,
  p_source public.order_source,
  p_items jsonb,
  p_total_satang integer,
  p_allergy_note text default null,
  p_pickup_at timestamptz default null,
  p_release_at timestamptz default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_shop shops%rowtype;
  v_count integer;
  v_sum integer;
  v_used integer;
begin
  if p_source = 'walk_in_quick' then
    raise exception 'use add_quick_walk_in for quick walk-ins';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order needs at least one item';
  end if;
  if p_source = 'app' and not (select is_open from shops where id = p_shop_id) then
    raise exception 'shop is not taking orders';
  end if;

  select sum((i ->> 'qty')::integer), sum((i ->> 'line_total_satang')::integer)
  into v_count, v_sum
  from jsonb_array_elements(p_items) i;
  if v_sum is distinct from p_total_satang then
    raise exception 'total % does not match items %', p_total_satang, v_sum;
  end if;

  if p_source = 'app' then
    -- Lock the shop so parallel pre-orders for one slot are checked one at a time.
    select * into v_shop from shops where id = p_shop_id for update;
    if v_count > v_shop.max_dishes_per_order then
      raise exception 'too_many_dishes' using errcode = 'P0001';
    end if;
    if p_pickup_at is not null then
      select coalesce(sum(item_count), 0) into v_used
      from orders
      where shop_id = p_shop_id
        and pickup_at = p_pickup_at
        and (status in ('queued', 'cooking', 'ready')
             or (status = 'awaiting_payment' and payment_expires_at > now()));
      if v_used + v_count > v_shop.preorder_dishes_per_slot then
        raise exception 'slot_full' using errcode = 'P0001';
      end if;
    end if;
  end if;

  insert into orders (
    shop_id, customer_id, customer_name, source, status, item_count, total_satang,
    payment_expires_at, pickup_at, release_at, allergy_note
  ) values (
    p_shop_id, p_customer_id, left(btrim(p_customer_name), 30), p_source,
    case when p_source = 'app' then 'awaiting_payment' else 'queued' end::order_status,
    v_count, p_total_satang,
    case when p_source = 'app' then now() + interval '5 minutes' end,
    p_pickup_at, p_release_at, nullif(btrim(coalesce(p_allergy_note, '')), '')
  ) returning * into v_order;

  insert into order_items (
    order_id, menu_id, menu_name, selections, kitchen_summary, note, qty,
    unit_price_satang, line_total_satang
  )
  select v_order.id, (i ->> 'menu_id')::uuid, i ->> 'menu_name', i -> 'selections',
         i ->> 'kitchen_summary', nullif(btrim(coalesce(i ->> 'note', '')), ''),
         (i ->> 'qty')::integer, (i ->> 'unit_price_satang')::integer,
         (i ->> 'line_total_satang')::integer
  from jsonb_array_elements(p_items) i;

  if p_source = 'app' then
    insert into payments (order_id, method, amount_satang) values (v_order.id, 'demo', p_total_satang);
  else
    -- Walk-in (cash at the counter) and simulated orders queue at once.
    v_order := queue_order(v_order.id);
  end if;

  perform log_event('order_created', p_shop_id, v_order.id,
    case when p_source = 'app' then 'customer' else 'vendor' end::user_role,
    p_customer_id, jsonb_build_object('source', p_source, 'item_count', v_count));
  return v_order;
end;
$$;
