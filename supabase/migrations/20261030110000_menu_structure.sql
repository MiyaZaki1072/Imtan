-- Phase 7: vendors edit a whole menu structure (PLAN.md §6). One transactional function replaces
-- a menu's groups, options, tier prices, variants and ingredient links from a JSON document,
-- so a menu is never half-saved. Option/group ids are kept (the editor sends them), and placed
-- orders are unaffected because order_items snapshot names, selections and prices.
-- Both functions run for service_role only; server actions call them after requireVendor().

create function public.vendor_save_menu(p_shop_id uuid, p_menu jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := (p_menu ->> 'id')::uuid;
  g jsonb;
  o jsonb;
  t jsonb;
  v jsonb;
begin
  if exists (select 1 from menus where id = v_id) then
    if not exists (
      select 1 from menus where id = v_id and shop_id = p_shop_id and deleted_at is null
    ) then
      raise exception 'menu is not in this shop';
    end if;
    update menus set
      category = p_menu ->> 'category',
      name = p_menu ->> 'name',
      cook_seconds = (p_menu ->> 'cook_seconds')::integer,
      base_price_satang = (p_menu ->> 'base_price_satang')::integer,
      pair_only = (p_menu ->> 'pair_only')::boolean,
      is_available = (p_menu ->> 'is_available')::boolean
    where id = v_id;
    delete from menu_ingredients where menu_id = v_id;
    delete from menu_variants where menu_id = v_id;
    delete from option_groups where menu_id = v_id; -- options and tier prices cascade
  else
    insert into menus (
      id, shop_id, category, name, cook_seconds, base_price_satang, pair_only, is_available, sort
    ) values (
      v_id, p_shop_id, p_menu ->> 'category', p_menu ->> 'name',
      (p_menu ->> 'cook_seconds')::integer, (p_menu ->> 'base_price_satang')::integer,
      (p_menu ->> 'pair_only')::boolean, (p_menu ->> 'is_available')::boolean,
      coalesce((select max(sort) + 1 from menus where shop_id = p_shop_id), 0)
    );
  end if;

  insert into menu_ingredients (menu_id, ingredient_id)
  select v_id, x::uuid from jsonb_array_elements_text(p_menu -> 'ingredient_ids') x;

  -- Groups in order: a show_when group must already exist, so it has to come earlier.
  for g in select * from jsonb_array_elements(p_menu -> 'groups') loop
    insert into option_groups (
      id, menu_id, name, kind, min_select, max_select, sort,
      show_when_group_id, show_when_option_ids, select_all_label, note
    ) values (
      (g ->> 'id')::uuid, v_id, g ->> 'name', (g ->> 'kind')::option_group_kind,
      (g ->> 'min_select')::integer, (g ->> 'max_select')::integer, (g ->> 'sort')::integer,
      (g ->> 'show_when_group_id')::uuid,
      case when g -> 'show_when_option_ids' is null or jsonb_typeof(g -> 'show_when_option_ids') = 'null'
        then null
        else (select array_agg(x::uuid) from jsonb_array_elements_text(g -> 'show_when_option_ids') x)
      end,
      g ->> 'select_all_label', g ->> 'note'
    );
    for o in select * from jsonb_array_elements(g -> 'options') loop
      insert into options (
        id, group_id, name, price_delta_satang, ingredient_id, is_default, is_available, sort
      ) values (
        (o ->> 'id')::uuid, (g ->> 'id')::uuid, o ->> 'name',
        (o ->> 'price_delta_satang')::integer, (o ->> 'ingredient_id')::uuid,
        (o ->> 'is_default')::boolean, (o ->> 'is_available')::boolean, (o ->> 'sort')::integer
      );
    end loop;
    for t in select * from jsonb_array_elements(g -> 'tier_prices') loop
      insert into group_tier_prices (group_id, selected_count, price_satang)
      values ((g ->> 'id')::uuid, (t ->> 'selected_count')::integer, (t ->> 'price_satang')::integer);
    end loop;
  end loop;

  for v in select * from jsonb_array_elements(p_menu -> 'variants') loop
    insert into menu_variants (menu_id, option_ids, price_satang, is_available)
    values (
      v_id,
      (select array_agg(x::uuid order by x::uuid) from jsonb_array_elements_text(v -> 'option_ids') x),
      (v ->> 'price_satang')::integer,
      coalesce((v ->> 'is_available')::boolean, true)
    );
  end loop;

  return v_id;
end;
$$;

-- A menu with past orders is hidden (soft delete) so history keeps its menu id; others are removed.
create function public.vendor_delete_menu(p_shop_id uuid, p_menu_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from menus where id = p_menu_id and shop_id = p_shop_id) then
    raise exception 'menu is not in this shop';
  end if;
  if exists (select 1 from order_items where menu_id = p_menu_id) then
    update menus set deleted_at = now(), is_available = false where id = p_menu_id;
    return 'soft';
  end if;
  delete from menus where id = p_menu_id;
  return 'hard';
end;
$$;

revoke execute on function public.vendor_save_menu(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.vendor_delete_menu(uuid, uuid) from public, anon, authenticated;
grant execute on function public.vendor_save_menu(uuid, jsonb) to service_role;
grant execute on function public.vendor_delete_menu(uuid, uuid) to service_role;
