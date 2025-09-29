import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/utils/supabase/service-role";
import { incrementUserBalance } from "@/utils/billing";

type Json = Record<string, unknown>;

export interface InviteRelation {
  inviter_id: string;
  invitee_id: string;
  reward_amount: number;
  status: "pending" | "rewarded" | "expired";
  created_at: string;
  rewarded_at: string | null;
}

function getClient(): SupabaseClient {
  return createServiceRoleClient();
}

export async function registerInviteRelation(input: {
  inviterId: string;
  inviteeId: string;
  rewardAmount?: number;
}) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("invite_relations")
    .insert({
      inviter_id: input.inviterId,
      invitee_id: input.inviteeId,
      reward_amount: input.rewardAmount ?? 0,
    })
    .select(
      "inviter_id, invitee_id, reward_amount, status, created_at, rewarded_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return data as InviteRelation;
}

export async function markInviteRewarded(input: {
  inviterId: string;
  inviteeId: string;
  amount: number;
  actorId?: string;
  metadata?: Json;
}) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("invite_relations")
    .update({
      reward_amount: input.amount,
      status: "rewarded",
      rewarded_at: new Date().toISOString(),
    })
    .eq("inviter_id", input.inviterId)
    .eq("invitee_id", input.inviteeId)
    .eq("status", "pending")
    .select(
      "inviter_id, invitee_id, reward_amount, status, created_at, rewarded_at"
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("未找到待发放的邀请记录");
  }

  await incrementUserBalance(input.inviterId, input.amount, {
    actorId: input.actorId,
    metadata: { reason: "invite_reward", inviteeId: input.inviteeId, ...input.metadata },
  });

  return data as InviteRelation;
}

export async function listInviteRelations(userId: string, limit = 50) {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("invite_relations")
    .select(
      "inviter_id, invitee_id, reward_amount, status, created_at, rewarded_at"
    )
    .or(`inviter_id.eq.${userId},invitee_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data as InviteRelation[];
}
