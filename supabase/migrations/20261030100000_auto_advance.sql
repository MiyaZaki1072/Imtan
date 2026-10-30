-- Phase 6 demo tools: "เดินคิวอัตโนมัติ" (PLAN.md §5d). When a shop has auto_advance on,
-- the minute job moves its simulated orders: queued → cooking → ready → picked_up,
-- taking item_count × seconds-per-dish to cook, so the queue moves during a talk.

alter table public.shops add column auto_advance boolean not null default false;

create function public.advance_simulated_orders()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_shop uuid;
  v_spi integer;
begin
  for v_shop in select id from shops where auto_advance loop
    v_spi := shop_seconds_per_item(v_shop);

    update orders set status = 'picked_up', picked_up_at = now(), picked_up_by = 'auto'
    where shop_id = v_shop and source = 'simulated' and status = 'ready'
      and ready_at < now() - interval '60 seconds';

    update orders set status = 'ready', ready_at = now()
    where shop_id = v_shop and source = 'simulated' and status = 'cooking'
      and started_at + make_interval(secs => item_count * v_spi) <= now();

    -- One order is cooked at a time: start the oldest waiting one.
    if not exists (
      select 1 from orders where shop_id = v_shop and source = 'simulated' and status = 'cooking'
    ) then
      update orders set status = 'cooking', started_at = now()
      where id = (
        select id from orders
        where shop_id = v_shop and source = 'simulated' and status = 'queued'
        order by queued_at, queue_no
        limit 1
      );
    end if;
  end loop;
end;
$$;

-- Same as before, plus the auto-advance step.
create or replace function public.cron_tick()
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

  perform advance_simulated_orders();

  for v_shop in select id from shops loop
    perform refresh_shop_stats(v_shop);
  end loop;
end;
$$;

revoke execute on function public.advance_simulated_orders() from public, anon, authenticated;
grant execute on function public.advance_simulated_orders() to service_role;
