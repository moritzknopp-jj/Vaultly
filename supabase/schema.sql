-- Users meta table
create table if not exists public.users_meta (
  id uuid primary key references auth.users(id) on delete cascade,
  trial_start timestamptz not null default now(),
  is_paid boolean not null default false,
  paid_until timestamptz,
  device_ids text[] not null default '{}',
  btc_address text
);

-- Payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  btc_address text not null,
  amount_expected numeric not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.users_meta enable row level security;
alter table public.payments enable row level security;

-- RLS policies
drop policy if exists "Users can read own meta" on public.users_meta;
create policy "Users can read own meta" on public.users_meta
  for select using (auth.uid() = id);

drop policy if exists "Users can insert own meta" on public.users_meta;
create policy "Users can insert own meta" on public.users_meta
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own meta" on public.users_meta;
create policy "Users can update own meta" on public.users_meta
  for update using (auth.uid() = id);

drop policy if exists "Users can read own payments" on public.payments;
create policy "Users can read own payments" on public.payments
  for select using (auth.uid() = user_id);

-- Auto-create users_meta row when a new auth user is created.
-- This ensures a trial_start is always set, even if client-side upsert fails
-- (e.g. when Supabase requires email confirmation and no session is available).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- `on conflict (id) do nothing` is intentional: if a row already exists
  -- (e.g. created by client-side upsert before the trigger fires), we preserve
  -- the original trial_start so it is never reset.
  insert into public.users_meta (id, trial_start, is_paid, paid_until, device_ids, btc_address)
  values (new.id, now(), false, null, '{}', null)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
