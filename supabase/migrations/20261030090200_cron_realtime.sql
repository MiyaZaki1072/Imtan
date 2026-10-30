-- pg_cron: every minute (PLAN.md §4c). The extension was enabled in the dashboard (Phase 0).
create extension if not exists pg_cron;

select cron.schedule('imtan-tick', '* * * * *', 'select public.cron_tick()');

-- Realtime is a nudge; clients refetch on reconnect and focus (PLAN.md §5).
-- RLS still decides which rows each subscriber receives.
alter publication supabase_realtime add table
  public.shops, public.ingredients, public.menus, public.options, public.menu_variants,
  public.group_tier_prices, public.orders;
