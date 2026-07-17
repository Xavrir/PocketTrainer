begin;

create table if not exists nutrition_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  barcode text,
  name text not null check (length(trim(name)) between 1 and 160),
  brand text,
  serving_amount numeric(12,3) not null check (serving_amount > 0),
  serving_unit text not null check (length(trim(serving_unit)) between 1 and 32),
  serving_label text,
  calories_kcal numeric(12,3) not null check (calories_kcal >= 0),
  protein_g numeric(12,3) not null check (protein_g >= 0),
  carbohydrate_g numeric(12,3) not null check (carbohydrate_g >= 0),
  fat_g numeric(12,3) not null check (fat_g >= 0),
  fiber_g numeric(12,3) not null default 0 check (fiber_g >= 0),
  sugar_g numeric(12,3) not null default 0 check (sugar_g >= 0),
  sodium_mg numeric(12,3) not null default 0 check (sodium_mg >= 0),
  source text not null check (source in ('open_food_facts','custom','gemini_unverified')),
  authoritative boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists nutrition_foods_global_barcode_idx on nutrition_foods(barcode) where user_id is null and barcode is not null;
create unique index if not exists nutrition_foods_user_barcode_idx on nutrition_foods(user_id, barcode) where user_id is not null and barcode is not null;
create index if not exists nutrition_foods_user_idx on nutrition_foods(user_id, created_at desc);

create table if not exists food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  food_id uuid not null references nutrition_foods(id),
  servings numeric(10,3) not null check (servings > 0 and servings <= 100),
  consumed_at timestamptz not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack','other')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists food_entries_user_consumed_idx on food_entries(user_id, consumed_at desc);

-- Keep the API runtime role least-privileged. The conditional grant keeps
-- this migration usable before the role-creation step in database/README.md;
-- the README repeats the grants after creating the role when needed. Forced
-- RLS below still limits every operation to app.current_user_id.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'pockettrainer_runtime') then
    grant select, insert, update, delete on nutrition_foods to pockettrainer_runtime;
    grant select, insert, update, delete on food_entries to pockettrainer_runtime;
  end if;
end $$;

alter table nutrition_foods enable row level security;
alter table nutrition_foods force row level security;
drop policy if exists nutrition_foods_read on nutrition_foods;
create policy nutrition_foods_read on nutrition_foods for select using (user_id is null or user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists nutrition_foods_write on nutrition_foods;
create policy nutrition_foods_write on nutrition_foods for all
  using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
  with check (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid);
drop policy if exists nutrition_foods_owner_global on nutrition_foods;
create policy nutrition_foods_owner_global on nutrition_foods for all
  using (
    user_id is null
    and current_user = pg_get_userbyid((select relowner from pg_class where oid = 'nutrition_foods'::regclass))
  )
  with check (
    user_id is null
    and current_user = pg_get_userbyid((select relowner from pg_class where oid = 'nutrition_foods'::regclass))
  );

alter table food_entries enable row level security;
alter table food_entries force row level security;
drop policy if exists food_entries_owner on food_entries;
create policy food_entries_owner on food_entries for all
  using (user_id = nullif(current_setting('app.current_user_id', true), '')::uuid)
  with check (
    user_id = nullif(current_setting('app.current_user_id', true), '')::uuid
    and exists (select 1 from nutrition_foods where id = food_id)
  );

commit;
