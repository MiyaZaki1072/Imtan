-- SQL does only what must be atomic: writing an order + its items, assigning queue numbers,
-- recomputing shop stats (PLAN.md §1). Prices are never computed here; the server sends them.
-- Every security definer function sets search_path = public, pg_temp.

create function public.current_day()
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select (now() at time zone 'Asia/Bangkok')::date;
$$;

-- New auth user -> profile. Copies only a trimmed display_name; role is always customer.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 30);
begin
  insert into profiles (id, display_name, role)
  values (new.id, coalesce(nullif(v_name, ''), 'ลูกค้า'), 'customer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.log_event(
  p_name text,
  p_shop_id uuid,
  p_order_id uuid,
  p_actor public.user_role,
  p_user_id uuid,
  p_props jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into events (name, shop_id, order_id, actor_role, user_id, props)
  values (p_name, p_shop_id, p_order_id, p_actor, p_user_id, coalesce(p_props, '{}'::jsonb));
$$;

-- Next number for a shop today. FOR UPDATE on the counter row serialises concurrent calls;
-- unique (shop_id, day, queue_no) on orders is the safety net.
create function public.assign_queue_number(p_shop_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day date := current_day();
  v_no integer;
begin
  insert into shop_daily_counters (shop_id, day, last_no)
  values (p_shop_id, v_day, 0)
  on conflict (shop_id, day) do nothing;

  select last_no + 1 into v_no
  from shop_daily_counters
  where shop_id = p_shop_id and day = v_day
  for update;

  update shop_daily_counters set last_no = v_no
  where shop_id = p_shop_id and day = v_day;

  return v_no;
end;
$$;

-- Seconds per dish: manual, or the median of today's last 10 ready gaps ÷ item_count
-- (gaps under 15 min), clamped to 20 s–10 min, falling back to manual. PLAN.md §4c.
create function public.refresh_shop_stats(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shop shops%rowtype;
  v_median double precision;
  v_learned integer;
  v_spi integer;
  v_items integer;
  v_wait integer;
begin
  select * into v_shop from shops where id = p_shop_id;
  if not found then
    return;
  end if;

  select percentile_cont(0.5) within group (order by g) into v_median
  from (
    select extract(epoch from (ready_at - prev)) / item_count as g
    from (
      select ready_at, item_count, lag(ready_at) over (order by ready_at) as prev
      from orders
      where shop_id = p_shop_id
        and ready_at is not null
        and (ready_at at time zone 'Asia/Bangkok')::date = current_day()
    ) x
    where prev is not null and ready_at - prev < interval '15 minutes'
    order by ready_at desc
    limit 10
  ) y;

  v_learned := case
    when v_median is null then null
    else least(600, greatest(20, round(v_median)))::integer
  end;
  v_spi := case
    when v_shop.wait_mode = 'manual' then v_shop.manual_seconds_per_item
    else coalesce(v_learned, v_shop.manual_seconds_per_item)
  end;

  select coalesce(sum(item_count), 0) into v_items
  from orders
  where shop_id = p_shop_id
    and status in ('queued', 'cooking')
    and (release_at is null or release_at <= now());

  v_wait := v_items * v_spi;

  update shops set
    learned_seconds_per_item = v_learned,
    items_in_queue = v_items,
    est_wait_seconds = v_wait,
    busy_level = case
      when v_wait < 5 * 60 then 'ว่าง'
      when v_wait <= 12 * 60 then 'ปานกลาง'
      else 'แน่น'
    end,
    stats_updated_at = now()
  where id = p_shop_id;
end;
$$;

-- The seconds per dish refresh_shop_stats() last used, for per-order estimates.
create function public.shop_seconds_per_item(p_shop_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when wait_mode = 'manual' then manual_seconds_per_item
    else coalesce(learned_seconds_per_item, manual_seconds_per_item)
  end
  from shops where id = p_shop_id;
$$;

create function public.orders_refresh_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform refresh_shop_stats(old.shop_id);
  else
    perform refresh_shop_stats(new.shop_id);
  end if;
  return null;
end;
$$;

create trigger orders_stats
  after insert or update of status, item_count, release_at or delete on public.orders
  for each row execute function public.orders_refresh_stats();

create function public.shops_settings_refresh_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform refresh_shop_stats(new.id);
  return null;
end;
$$;

create trigger shops_settings_stats
  after update of wait_mode, manual_seconds_per_item on public.shops
  for each row execute function public.shops_settings_refresh_stats();

-- Gives a numbered queue slot to an order that is paid or needs no payment.
create function public.queue_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_prefix text;
  v_no integer;
  v_ahead integer;
  v_spi integer;
begin
  select * into v_order from orders where id = p_order_id for update;
  select queue_prefix into v_prefix from shops where id = v_order.shop_id;
  v_no := assign_queue_number(v_order.shop_id);

  select coalesce(sum(item_count), 0) into v_ahead
  from orders
  where shop_id = v_order.shop_id
    and id <> p_order_id
    and status in ('queued', 'cooking')
    and (release_at is null or release_at <= now());
  v_spi := shop_seconds_per_item(v_order.shop_id);

  update orders set
    status = 'queued',
    queue_no = v_no,
    queue_label = v_prefix || '-' || v_no,
    day = current_day(),
    queued_at = greatest(now(), coalesce(release_at, now())),
    estimated_wait_seconds = (v_ahead + v_order.item_count) * v_spi
  where id = p_order_id
  returning * into v_order;
  return v_order;
end;
$$;

-- Writes an order and its items in one transaction. Items carry server-computed prices
-- (lib/menu); SQL only checks that they add up.
-- p_items: [{menu_id, menu_name, selections, kitchen_summary, note, qty,
--            unit_price_satang, line_total_satang}]
create function public.insert_order(
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
  v_count integer;
  v_sum integer;
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

-- Pay first, then queue: the only way an app order gets a number.
create function public.confirm_payment(p_order_id uuid, p_method public.payment_method)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order not found';
  end if;
  if v_order.paid_at is not null then
    return v_order; -- already paid: idempotent
  end if;
  if v_order.status <> 'awaiting_payment' then
    raise exception 'order is %', v_order.status;
  end if;
  if v_order.payment_expires_at < now() then
    -- Return instead of raising, so the expiry is kept. The caller checks status.
    update orders set status = 'expired' where id = p_order_id returning * into v_order;
    update payments set status = 'expired' where order_id = p_order_id;
    perform log_event('expired', v_order.shop_id, p_order_id, null, null);
    return v_order;
  end if;

  update orders set paid_at = now() where id = p_order_id;
  update payments set status = 'confirmed', method = p_method, confirmed_at = now()
  where order_id = p_order_id;
  v_order := queue_order(p_order_id);

  perform log_event('paid', v_order.shop_id, v_order.id, 'customer', v_order.customer_id,
    jsonb_build_object('method', p_method, 'queue_label', v_order.queue_label));
  return v_order;
end;
$$;

-- "+1 คิวหน้าร้าน": no menu, optional dish count, counts toward wait times.
create function public.add_quick_walk_in(p_shop_id uuid, p_item_count integer default 1)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
begin
  if p_item_count < 1 or p_item_count > 20 then
    raise exception 'dish count must be 1-20';
  end if;
  insert into orders (shop_id, customer_name, source, status, item_count)
  values (p_shop_id, 'ลูกค้าหน้าร้าน', 'walk_in_quick', 'queued', p_item_count)
  returning * into v_order;
  v_order := queue_order(v_order.id);
  perform log_event('walk_in_quick', p_shop_id, v_order.id, 'vendor', null,
    jsonb_build_object('item_count', p_item_count));
  return v_order;
end;
$$;

-- Vendor board moves. queued → cooking | ready | cancelled; cooking → ready | cancelled;
-- ready → picked_up. Server actions call this after requireVendor(shopId).
create function public.vendor_set_order_status(
  p_shop_id uuid,
  p_order_id uuid,
  p_status public.order_status,
  p_reason text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_ok boolean;
begin
  select * into v_order from orders
  where id = p_order_id and shop_id = p_shop_id
  for update;
  if not found then
    raise exception 'order not found in this shop';
  end if;

  v_ok := (v_order.status = 'queued' and p_status in ('cooking', 'ready', 'cancelled'))
       or (v_order.status = 'cooking' and p_status in ('ready', 'cancelled'))
       or (v_order.status = 'ready' and p_status = 'picked_up');
  if not v_ok then
    raise exception 'cannot move % order to %', v_order.status, p_status;
  end if;

  update orders set
    status = p_status,
    started_at = case when p_status = 'cooking' then now() else started_at end,
    ready_at = case when p_status = 'ready' then now() else ready_at end,
    picked_up_at = case when p_status = 'picked_up' then now() else picked_up_at end,
    picked_up_by = case when p_status = 'picked_up' then 'vendor' else picked_up_by end,
    cancelled_at = case when p_status = 'cancelled' then now() else cancelled_at end,
    cancel_reason = case when p_status = 'cancelled' then p_reason else cancel_reason end,
    -- Refunds are recorded as simulated, back through the original method.
    refund_method = case
      when p_status = 'cancelled' and v_order.paid_at is not null
        then coalesce((select method from payments where order_id = p_order_id), 'demo')
      else refund_method
    end
  where id = p_order_id
  returning * into v_order;

  if p_status = 'cancelled' then
    update payments set status = 'refunded' where order_id = p_order_id and status = 'confirmed';
  end if;

  perform log_event(
    case p_status
      when 'cooking' then 'started'
      when 'ready' then 'ready'
      when 'picked_up' then 'picked_up'
      else 'cancelled'
    end,
    p_shop_id, p_order_id, 'vendor', null, '{}'::jsonb);
  return v_order;
end;
$$;

-- "เรียกซ้ำ"
create function public.vendor_recall_order(p_shop_id uuid, p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
begin
  update orders set last_called_at = now()
  where id = p_order_id and shop_id = p_shop_id and status = 'ready'
  returning * into v_order;
  if not found then
    raise exception 'order is not ready in this shop';
  end if;
  return v_order;
end;
$$;

-- Customer functions: check that the caller owns the order. ------------------------------

create function public.abandon_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update orders set status = 'abandoned'
  where id = p_order_id and customer_id = auth.uid() and status = 'awaiting_payment';
  if not found then
    raise exception 'order cannot be abandoned';
  end if;
  update payments set status = 'abandoned' where order_id = p_order_id;
  perform log_event('abandoned', null, p_order_id, 'customer', auth.uid());
end;
$$;

create function public.mark_received(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update orders set status = 'picked_up', picked_up_at = now(), picked_up_by = 'customer'
  where id = p_order_id and customer_id = auth.uid() and status = 'ready';
  if not found then
    raise exception 'order is not ready';
  end if;
  perform log_event('received', null, p_order_id, 'customer', auth.uid());
end;
$$;

-- Feedback opens at ready.
create function public.submit_feedback(p_order_id uuid, p_feedback public.wait_feedback)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update orders set feedback = p_feedback
  where id = p_order_id and customer_id = auth.uid() and status in ('ready', 'picked_up');
  if not found then
    raise exception 'feedback is not open for this order';
  end if;
  perform log_event('feedback', null, p_order_id, 'customer', auth.uid(),
    jsonb_build_object('feedback', p_feedback));
end;
$$;

-- Every minute (pg_cron): expire unpaid orders, close stale ready orders, release
-- pre-orders, refresh all shop stats.
create function public.cron_tick()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shop uuid;
  v_id uuid;
begin
  for v_id in
    update orders set status = 'expired'
    where status = 'awaiting_payment' and payment_expires_at < now()
    returning id
  loop
    update payments set status = 'expired' where order_id = v_id and status = 'pending';
    perform log_event('expired', null, v_id, null, null);
  end loop;

  update orders set status = 'picked_up', picked_up_at = now(), picked_up_by = 'auto'
  where status = 'ready' and ready_at < now() - interval '30 minutes';

  for v_shop in select id from shops loop
    perform refresh_shop_stats(v_shop);
  end loop;
end;
$$;

-- Grants (PLAN.md §4b) -----------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.current_role_name() to authenticated;
grant execute on function public.current_vendor_shop() to authenticated;

grant execute on function public.abandon_order(uuid) to authenticated;
grant execute on function public.mark_received(uuid) to authenticated;
grant execute on function public.submit_feedback(uuid, public.wait_feedback) to authenticated;

grant execute on function public.insert_order(uuid, uuid, text, public.order_source, jsonb, integer, text, timestamptz, timestamptz) to service_role;
grant execute on function public.confirm_payment(uuid, public.payment_method) to service_role;
grant execute on function public.assign_queue_number(uuid) to service_role;
grant execute on function public.queue_order(uuid) to service_role;
grant execute on function public.refresh_shop_stats(uuid) to service_role;
grant execute on function public.shop_seconds_per_item(uuid) to service_role;
grant execute on function public.add_quick_walk_in(uuid, integer) to service_role;
grant execute on function public.vendor_set_order_status(uuid, uuid, public.order_status, text) to service_role;
grant execute on function public.vendor_recall_order(uuid, uuid) to service_role;
grant execute on function public.log_event(text, uuid, uuid, public.user_role, uuid, jsonb) to service_role;
grant execute on function public.cron_tick() to service_role;
grant execute on function public.current_day() to service_role;
