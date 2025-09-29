import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
 
export async function chargeUsage(input: {
  userId: string;
  operation: string;
  units?: number;
  unitPrice?: number;
  metadata?: Json;
}) {
  const supabase = getClient();
  const { data, error } = await supabase.rpc("charge_usage", {
    p_user_id: input.userId,
    p_operation: input.operation,
    p_units: input.units ?? 1,
    p_unit_price: input.unitPrice ?? 0,
    p_metadata: input.metadata ?? {},
  });

  if (error) {
    throw error;
  }

  // data is the new balance returned from the function
  return Number(data ?? 0);
}

type Json = Record<string, unknown>;

export interface BillingAccount {
  user_id: string;
  balance: number;
  currency: string;
  updated_at: string;
}

export interface UsageLog {
  id: number;
  user_id: string;
  operation: string;
  units: number;
  unit_price: number;
  total_cost: number;
  metadata: Json | null;
  created_at: string;
}

function getClient(): SupabaseClient {
  return createServiceRoleClient();
}

export async function getBillingAccount(userId: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("billing_accounts")
    .select("user_id, balance, currency, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { user_id, balance, currency, updated_at } = data;

  return {
    user_id,
    balance: Number(balance ?? 0),
    currency,
    updated_at,
  } satisfies BillingAccount;
}

export async function incrementUserBalance(
  userId: string,
  amount: number,
  options?: { actorId?: string; metadata?: Json }
) {
  const supabase = getClient();
  const { error } = await supabase.rpc("increment_user_balance", {
    p_user_id: userId,
    p_amount: amount,
    p_actor: options?.actorId ?? null,
    p_metadata: options?.metadata ?? {},
  });

  if (error) {
    throw error;
  }
}

export async function deductUserBalance(
  userId: string,
  amount: number,
  options?: { actorId?: string; metadata?: Json }
) {
  const negativeAmount = -Math.abs(amount);
  await incrementUserBalance(userId, negativeAmount, options);
}

export async function logUsageEvent(
  input: {
    userId: string;
    operation: string;
    units?: number;
    unitPrice?: number;
    totalCost?: number;
    metadata?: Json;
  }
) {
  const { userId, operation, units = 1, unitPrice = 0, totalCost, metadata = {} } = input;
  const supabase = getClient();
  const cost = totalCost ?? Number((units * unitPrice).toFixed(2));

  const { error } = await supabase.from("usage_logs").insert({
    user_id: userId,
    operation,
    units,
    unit_price: unitPrice,
    total_cost: cost,
    metadata,
  });

  if (error) {
    throw error;
  }

  return cost;
}

export async function listUsageLogs(userId: string, limit = 50) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("usage_logs")
    .select("id, user_id, operation, units, unit_price, total_cost, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data as UsageLog[];
}
