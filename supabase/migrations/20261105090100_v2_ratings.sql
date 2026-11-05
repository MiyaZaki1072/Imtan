-- V2 Phase 15 (PLAN-V2.md): shop ratings. Customers rate their own picked-up orders through
-- submit_rating(); shops.rating_avg/rating_count are written only by refresh_shop_stats().
-- Additive only.

alter default privileges revoke execute on functions from public;

alter table public.orders
  add column shop_rating smallint null check (shop_rating between 1 and 5),
  add column rating_comment text null check (char_length(rating_comment) <= 200);

alter table public.shops
  add column rating_avg numeric null,
  add column rating_count integer not null default 0;

create or replace function public.refresh_shop_stats(p_shop_id uuid)
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
  v_rating_avg numeric;
  v_rating_count integer;
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

  select round(avg(shop_rating), 1), count(shop_rating) into v_rating_avg, v_rating_count
  from orders where shop_id = p_shop_id and shop_rating is not null;

  update shops set
    learned_seconds_per_item = v_learned,
    items_in_queue = v_items,
    est_wait_seconds = v_wait,
    busy_level = case
      when v_wait < 5 * 60 then 'ว่าง'
      when v_wait <= 12 * 60 then 'ปานกลาง'
      else 'แน่น'
    end,
    rating_avg = v_rating_avg,
    rating_count = v_rating_count,
    stats_updated_at = now()
  where id = p_shop_id;
end;
$$;

-- Same pattern as submit_feedback: the owner only, picked-up orders only. Rating again
-- overwrites the earlier rating.
create function public.submit_rating(p_order_id uuid, p_rating integer, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shop uuid;
begin
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'rating must be 1 to 5';
  end if;
  update orders set
    shop_rating = p_rating,
    rating_comment = nullif(left(btrim(coalesce(p_comment, '')), 200), '')
  where id = p_order_id and customer_id = auth.uid() and status = 'picked_up'
  returning shop_id into v_shop;
  if not found then
    raise exception 'rating is not open for this order';
  end if;
  perform refresh_shop_stats(v_shop);
  perform log_event('rating', v_shop, p_order_id, 'customer', auth.uid(),
    jsonb_build_object('rating', p_rating));
end;
$$;

grant execute on function public.submit_rating(uuid, integer, text) to authenticated;
