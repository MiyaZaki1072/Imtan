-- อิ่มทัน schema: PLAN.md §4 data model, §4b security basics.
-- Reads go through RLS. Clients never write tables: all writes use server actions with the
-- service-role client, or the customer functions in the next migration.

-- Functions are not executable by default. Each one is granted explicitly.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Clients only ever read. Supabase grants table writes to anon/authenticated by default.
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon, authenticated;

create type public.user_role as enum ('customer', 'vendor', 'admin');
create type public.order_status as enum (
  'awaiting_payment', 'expired', 'abandoned',
  'queued', 'cooking', 'ready', 'picked_up', 'cancelled'
);
create type public.order_source as enum ('app', 'walk_in_quick', 'walk_in_full', 'simulated');
create type public.payment_method as enum ('demo', 'cash');
create type public.wait_mode as enum ('auto', 'manual');
create type public.option_group_kind as enum ('variant', 'tiered', 'choice', 'remove', 'toppings');
create type public.wait_feedback as enum ('faster', 'accurate', 'slower');

-- Shops -----------------------------------------------------------------------

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  category text not null check (char_length(btrim(category)) between 1 and 80),
  queue_prefix text not null check (char_length(btrim(queue_prefix)) between 1 and 8),
  is_open boolean not null default true,
  allow_item_note boolean not null default true,
  allow_allergy_note boolean not null default true,
  wait_mode public.wait_mode not null default 'auto',
  -- Vendor's value; also the fallback for auto mode.
  manual_seconds_per_item integer not null check (manual_seconds_per_item > 0),
  -- Stats below are written only by refresh_shop_stats().
  learned_seconds_per_item integer check (learned_seconds_per_item > 0),
  items_in_queue integer not null default 0,
  est_wait_seconds integer not null default 0,
  busy_level text not null default 'ว่าง' check (busy_level in ('ว่าง', 'ปานกลาง', 'แน่น')),
  stats_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  role public.user_role not null default 'customer',
  shop_id uuid references public.shops (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint vendor_has_shop check (role <> 'vendor' or shop_id is not null)
);

-- Menus (PLAN.md §4a) ----------------------------------------------------------

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  is_available boolean not null default true,
  unique (shop_id, name)
);

create table public.menus (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  category text not null,
  name text not null,
  cook_seconds integer not null check (cook_seconds > 0),
  base_price_satang integer check (base_price_satang > 0),
  pair_only boolean not null default false,
  is_available boolean not null default true,
  deleted_at timestamptz,
  sort integer not null default 0
);
create index menus_shop_idx on public.menus (shop_id, sort);

create table public.menu_ingredients (
  menu_id uuid not null references public.menus (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  primary key (menu_id, ingredient_id)
);

create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  name text not null,
  kind public.option_group_kind not null,
  min_select integer not null check (min_select >= 0),
  max_select integer not null check (max_select >= 1),
  sort integer not null default 0,
  show_when_group_id uuid references public.option_groups (id) on delete cascade,
  show_when_option_ids uuid[],
  select_all_label text,
  note text,
  check (min_select <= max_select),
  check (kind <> 'variant' or (min_select = 1 and max_select = 1)),
  check ((show_when_group_id is null) = (show_when_option_ids is null))
);
create index option_groups_menu_idx on public.option_groups (menu_id, sort);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.option_groups (id) on delete cascade,
  name text not null,
  price_delta_satang integer not null default 0 check (price_delta_satang >= 0),
  ingredient_id uuid references public.ingredients (id) on delete set null,
  is_default boolean not null default false,
  is_available boolean not null default true,
  sort integer not null default 0
);
create index options_group_idx on public.options (group_id, sort);

create table public.menu_variants (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus (id) on delete cascade,
  -- One option per variant group, sorted.
  option_ids uuid[] not null,
  -- Null only while a new combination waits for a price (Phase 7).
  price_satang integer check (price_satang > 0),
  is_available boolean not null default true,
  unique (menu_id, option_ids)
);

create table public.group_tier_prices (
  group_id uuid not null references public.option_groups (id) on delete cascade,
  selected_count integer not null check (selected_count >= 1),
  price_satang integer not null check (price_satang > 0),
  primary key (group_id, selected_count)
);

-- Ingredients are per shop: a menu or option may only use its own shop's ingredients.
create function public.assert_ingredient_same_shop()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_menu_shop uuid;
  v_ing_shop uuid;
begin
  if new.ingredient_id is null then
    return new;
  end if;
  if tg_table_name = 'menu_ingredients' then
    select shop_id into v_menu_shop from menus where id = new.menu_id;
  else
    select m.shop_id into v_menu_shop
    from option_groups g join menus m on m.id = g.menu_id
    where g.id = new.group_id;
  end if;
  select shop_id into v_ing_shop from ingredients where id = new.ingredient_id;
  if v_menu_shop is distinct from v_ing_shop then
    raise exception 'ingredient % belongs to another shop', new.ingredient_id;
  end if;
  return new;
end;
$$;

create trigger menu_ingredients_same_shop
  before insert or update on public.menu_ingredients
  for each row execute function public.assert_ingredient_same_shop();
create trigger options_same_shop
  before insert or update on public.options
  for each row execute function public.assert_ingredient_same_shop();

-- Queue and orders --------------------------------------------------------------

create table public.shop_daily_counters (
  shop_id uuid not null references public.shops (id) on delete cascade,
  day date not null,
  last_no integer not null default 0,
  primary key (shop_id, day)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_id uuid references public.profiles (id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 1 and 30),
  queue_no integer,
  queue_label text,
  day date,
  source public.order_source not null,
  status public.order_status not null,
  -- Σ qty, or the dish count of a +1 walk-in.
  item_count integer not null check (item_count >= 1),
  -- Null only for quick walk-ins.
  total_satang integer check (total_satang >= 0),
  payment_expires_at timestamptz,
  paid_at timestamptz,
  pickup_at timestamptz,
  release_at timestamptz,
  -- greatest(paid_at, release_at); for walk-ins the time they were added.
  queued_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  cancelled_at timestamptz,
  picked_up_by text check (picked_up_by in ('vendor', 'customer', 'auto')),
  cancel_reason text,
  refund_method public.payment_method,
  last_called_at timestamptz,
  allergy_note text check (char_length(allergy_note) <= 100),
  feedback public.wait_feedback,
  estimated_wait_seconds integer,
  unique (shop_id, day, queue_no),
  check ((queue_no is null) = (queue_label is null) and (queue_no is null) = (day is null)),
  check (total_satang is not null or source = 'walk_in_quick'),
  -- Pay first, then queue: an app order only gets a number once paid.
  check (source <> 'app' or queue_no is null or paid_at is not null)
);
create index orders_shop_status_idx on public.orders (shop_id, status);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_expiry_idx on public.orders (payment_expires_at) where status = 'awaiting_payment';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_id uuid references public.menus (id) on delete set null,
  menu_name text not null,
  selections jsonb not null,
  kitchen_summary text not null,
  note text check (char_length(note) <= 100),
  qty integer not null check (qty between 1 and 20),
  unit_price_satang integer not null check (unit_price_satang >= 0),
  line_total_satang integer not null,
  check (line_total_satang = unit_price_satang * qty)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  method public.payment_method not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'expired', 'abandoned', 'refunded')),
  amount_satang integer not null check (amount_satang >= 0),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table public.events (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_role public.user_role,
  user_id uuid,
  shop_id uuid,
  order_id uuid,
  name text not null,
  props jsonb not null default '{}'::jsonb
);
create index events_at_idx on public.events (at);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger shops_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

-- Table privileges ----------------------------------------------------------------

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;
-- The one client write: a user may rename themselves.
grant update (display_name) on public.profiles to authenticated;

-- RLS helpers. security definer so policies can read profiles without recursion.
create function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from profiles where id = auth.uid();
$$;

create function public.current_vendor_shop()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select shop_id from profiles where id = auth.uid() and role = 'vendor';
$$;

grant execute on function public.current_role_name() to authenticated;
grant execute on function public.current_vendor_shop() to authenticated;

-- RLS: every table on, read policies only -------------------------------------------

alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.ingredients enable row level security;
alter table public.menus enable row level security;
alter table public.menu_ingredients enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;
alter table public.menu_variants enable row level security;
alter table public.group_tier_prices enable row level security;
alter table public.shop_daily_counters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.events enable row level security;
alter table public.push_subscriptions enable row level security;

-- Menus, shops and ingredients: public.
create policy "public read" on public.shops for select to anon, authenticated using (true);
create policy "public read" on public.ingredients for select to anon, authenticated using (true);
create policy "public read" on public.menus for select to anon, authenticated using (true);
create policy "public read" on public.menu_ingredients for select to anon, authenticated using (true);
create policy "public read" on public.option_groups for select to anon, authenticated using (true);
create policy "public read" on public.options for select to anon, authenticated using (true);
create policy "public read" on public.menu_variants for select to anon, authenticated using (true);
create policy "public read" on public.group_tier_prices for select to anon, authenticated using (true);

-- Profiles: your own; admins see all.
create policy "own or admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.current_role_name()) = 'admin');
create policy "rename self" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Orders: customer sees their own. Vendor sees their shop's orders that are paid or not
-- from the app (never unpaid app orders). Admin sees all.
create policy "customer, vendor or admin" on public.orders for select to authenticated
  using (
    customer_id = (select auth.uid())
    or (
      shop_id = (select public.current_vendor_shop())
      and (paid_at is not null or source <> 'app')
    )
    or (select public.current_role_name()) = 'admin'
  );

-- Items and payments follow their order's visibility (the orders policy applies inside).
create policy "via order" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy "via order" on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy "admin only" on public.events for select to authenticated
  using ((select public.current_role_name()) = 'admin');

create policy "own" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
