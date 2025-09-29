import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const [billingAccount, usageLogs, transactions, invites] = await Promise.all([
    supabase
      .from("billing_accounts")
      .select("user_id, balance, currency, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("usage_logs")
      .select("id, operation, units, unit_price, total_cost, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("payment_transactions")
      .select(
        "id, provider, provider_transaction_id, amount, status, metadata, created_at, completed_at"
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("invite_relations")
      .select("inviter_id, invitee_id, reward_amount, status, created_at, rewarded_at")
      .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (billingAccount.error) {
    return NextResponse.json({ error: billingAccount.error.message }, { status: 400 });
  }

  if (usageLogs.error) {
    return NextResponse.json({ error: usageLogs.error.message }, { status: 400 });
  }

  if (transactions.error) {
    return NextResponse.json({ error: transactions.error.message }, { status: 400 });
  }

  if (invites.error) {
    return NextResponse.json({ error: invites.error.message }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const origin = siteUrl.replace(/\/$/, "");

  return NextResponse.json({
    userId: user.id,
    billing: billingAccount.data ?? null,
    usageLogs: usageLogs.data ?? [],
    transactions: transactions.data ?? [],
    invites: invites.data ?? [],
    inviteLink: origin ? `${origin}/login?inviter=${user.id}` : null,
  });
}
