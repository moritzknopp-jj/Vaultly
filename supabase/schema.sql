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
create policy "Users can read own meta" on public.users_meta
  for select using (auth.uid() = id);

create policy "Users can update own meta" on public.users_meta
  for update using (auth.uid() = id);

create policy "Users can read own payments" on public.payments
  for select using (auth.uid() = user_id);
