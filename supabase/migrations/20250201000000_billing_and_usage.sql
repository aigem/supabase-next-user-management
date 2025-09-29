-- Billing, payment, usage, invitation, and auditing schema additions

-- Billing accounts keep track of each user's available balance.
create table if not exists public.billing_accounts (
  user_id uuid primary key references auth.users on delete cascade,
  balance numeric(12, 2) not null default 0,
  currency text not null default 'CNY',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_accounts_balance_nonnegative check (balance >= 0)
);

create index if not exists billing_accounts_currency_idx on public.billing_accounts (currency);

alter table public.billing_accounts enable row level security;

create policy if not exists "Users can view their billing account" on public.billing_accounts
  for select using (auth.uid() = user_id);

create policy if not exists "Service role can manage billing accounts" on public.billing_accounts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_billing_accounts_updated_at on public.billing_accounts;

create trigger set_billing_accounts_updated_at
  before update on public.billing_accounts
  for each row execute procedure public.set_updated_at_timestamp();


-- Payment transactions store top-up orders and gateway callbacks.
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null,
  provider_transaction_id text,
  amount numeric(12, 2) not null,
  status text not null check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  metadata jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists payment_transactions_user_idx on public.payment_transactions (user_id, created_at desc);
create index if not exists payment_transactions_provider_idx on public.payment_transactions (provider, provider_transaction_id);

alter table public.payment_transactions enable row level security;

create policy if not exists "Users can read their payment transactions" on public.payment_transactions
  for select using (auth.uid() = user_id);

create policy if not exists "Users can create pending payment transactions" on public.payment_transactions
  for insert with check (auth.uid() = user_id and status = 'pending');

create policy if not exists "Service role can manage payment transactions" on public.payment_transactions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');


-- Usage logs store API consumption records for auditing and billing.
create table if not exists public.usage_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  operation text not null,
  units integer not null default 1,
  unit_price numeric(12, 4) not null default 0,
  total_cost numeric(12, 2) not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_user_idx on public.usage_logs (user_id, created_at desc);

alter table public.usage_logs enable row level security;

create policy if not exists "Users can view their usage logs" on public.usage_logs
  for select using (auth.uid() = user_id);

create policy if not exists "Service role can manage usage logs" on public.usage_logs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');


-- Invitation relationships track referrals and reward payouts.
create table if not exists public.invite_relations (
  inviter_id uuid not null references auth.users on delete cascade,
  invitee_id uuid not null references auth.users on delete cascade,
  reward_amount numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'rewarded', 'expired')),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  constraint invite_relations_pk primary key (inviter_id, invitee_id)
);

create unique index if not exists invite_relations_invitee_idx on public.invite_relations (invitee_id);

alter table public.invite_relations enable row level security;

create policy if not exists "Users can view their invites" on public.invite_relations
  for select using (auth.uid() = inviter_id or auth.uid() = invitee_id);

create policy if not exists "Service role can manage invites" on public.invite_relations
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');


-- Audit logs capture critical balance operations.
create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid,
  event text not null,
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy if not exists "Users can view their audit events" on public.audit_logs
  for select using (auth.uid() = actor_id);

create policy if not exists "Service role can manage audit logs" on public.audit_logs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');


-- Utility function to upsert billing account balances atomically.
create or replace function public.increment_user_balance(
  p_user_id uuid,
  p_amount numeric,
  p_actor uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  if p_amount = 0 then
    return;
  end if;

  insert into public.billing_accounts (user_id, balance)
    values (p_user_id, greatest(p_amount, 0))
  on conflict (user_id) do update set
    balance = greatest(public.billing_accounts.balance + excluded.balance, 0),
    updated_at = now();

  insert into public.audit_logs (actor_id, event, target_table, target_id, metadata)
  values (
    coalesce(p_actor, p_user_id),
    case when p_amount >= 0 then 'balance_increment' else 'balance_decrement' end,
    'billing_accounts',
    p_user_id,
    jsonb_build_object('amount', p_amount, 'context', p_metadata)
  );
end;
$$;


-- Trigger to automatically create a billing account when new user signs up.
create or replace function public.create_billing_account_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.billing_accounts (user_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_billing on auth.users;

create trigger on_auth_user_created_billing
  after insert on auth.users
  for each row execute procedure public.create_billing_account_for_new_user();
