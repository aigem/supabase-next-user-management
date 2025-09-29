import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/utils/supabase/service-role";

type Json = Record<string, unknown>;

export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export interface PaymentTransaction {
  id: string;
  user_id: string;
  provider: string;
  provider_transaction_id: string | null;
  amount: number;
  status: PaymentStatus;
  metadata: Json | null;
  created_at: string;
  completed_at: string | null;
}

function getClient(): SupabaseClient {
  return createServiceRoleClient();
}

export async function createPendingTransaction(input: {
  userId: string;
  provider: string;
  amount: number;
  metadata?: Json;
}) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("payment_transactions")
    .insert({
      user_id: input.userId,
      provider: input.provider,
      amount: input.amount,
      status: "pending",
      metadata: input.metadata ?? {},
    })
    .select(
      "id, user_id, provider, provider_transaction_id, amount, status, metadata, created_at, completed_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return data as PaymentTransaction;
}

export async function getTransactionById(id: string) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("payment_transactions")
    .select(
      "id, user_id, provider, provider_transaction_id, amount, status, metadata, created_at, completed_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PaymentTransaction | null;
}

export async function updateTransactionStatus(input: {
  id: string;
  status: PaymentStatus;
  providerTransactionId?: string | null;
  metadata?: Json;
  completedAt?: string;
  expectedStatus?: PaymentStatus;
}) {
  const supabase = getClient();
  const query = supabase
    .from("payment_transactions")
    .update({
      status: input.status,
      provider_transaction_id: input.providerTransactionId ?? null,
      metadata: input.metadata ?? {},
      completed_at: input.completedAt ?? new Date().toISOString(),
    })
    .eq("id", input.id);

  if (input.expectedStatus) {
    query.eq("status", input.expectedStatus);
  }

  const { data, error } = await query
    .select(
      "id, user_id, provider, provider_transaction_id, amount, status, metadata, created_at, completed_at"
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("交易状态已更新");
  }

  return data as PaymentTransaction;
}

export async function listUserTransactions(userId: string, limit = 20) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("payment_transactions")
    .select(
      "id, user_id, provider, provider_transaction_id, amount, status, metadata, created_at, completed_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data as PaymentTransaction[];
}
