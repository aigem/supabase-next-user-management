-- Atomic usage charge: deduct balance and log usage in a single transaction
create or replace function public.charge_usage(
  p_user_id uuid,
  p_operation text,
  p_units integer default 1,
  p_unit_price numeric default 0,
  p_metadata jsonb default '{}'::jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost numeric(12,2);
  v_balance numeric(12,2);
begin
  -- Normalize inputs
  v_cost := round(coalesce(p_units, 1) * coalesce(p_unit_price, 0), 2);

  -- Ensure account exists and lock the row for atomic update
  -- Create account if missing
  insert into public.billing_accounts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  -- Lock user's balance row
  select balance into v_balance
  from public.billing_accounts
  where user_id = p_user_id
  for update;

  if v_balance is null then
    v_balance := 0;
  end if;

  -- Zero or negative cost: no deduction, still return current balance
  if v_cost <= 0 then
    return v_balance;
  end if;

  -- Insufficient funds protection
  if v_balance < v_cost then
    -- Raise a typed error to be handled by the API
    raise exception 'INSUFFICIENT_FUNDS'
      using detail = json_build_object('balance', v_balance, 'cost', v_cost)::text;
  end if;

  -- Deduct balance
  update public.billing_accounts
  set balance = v_balance - v_cost,
      updated_at = now()
  where user_id = p_user_id;

  -- Log usage
  insert into public.usage_logs (user_id, operation, units, unit_price, total_cost, metadata)
  values (p_user_id, coalesce(p_operation, 'unknown'), coalesce(p_units, 1), coalesce(p_unit_price, 0), v_cost, coalesce(p_metadata, '{}'::jsonb));

  -- Audit
  insert into public.audit_logs (actor_id, event, target_table, target_id, metadata)
  values (
    p_user_id,
    'usage_charge',
    'billing_accounts',
    p_user_id,
    jsonb_build_object('operation', p_operation, 'units', p_units, 'unit_price', p_unit_price, 'total_cost', v_cost, 'context', p_metadata)
  );

  -- Return new balance
  return (select balance from public.billing_accounts where user_id = p_user_id);
end;
$$;