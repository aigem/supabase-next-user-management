import { NextResponse } from "next/server";
import { markInviteRewarded } from "@/utils/invites";

interface RewardBody {
  inviterId?: string;
  inviteeId?: string;
  amount?: number;
  metadata?: Record<string, unknown>;
}

export async function POST(request: Request) {
  const token = request.headers.get("x-internal-token");
  const expected = process.env.INTERNAL_API_KEY;

  if (!expected) {
    return NextResponse.json({ error: "缺少 INTERNAL_API_KEY 环境变量" }, { status: 500 });
  }

  if (token !== expected) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  let body: RewardBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const inviterId = body.inviterId ?? "";
  const inviteeId = body.inviteeId ?? "";
  const amount = Number(body.amount ?? 0);

  if (!inviterId || !inviteeId) {
    return NextResponse.json({ error: "缺少 inviterId 或 inviteeId" }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "奖励金额必须大于 0" }, { status: 400 });
  }

  try {
    const relation = await markInviteRewarded({
      inviterId,
      inviteeId,
      amount: Number(amount.toFixed(2)),
      metadata: body.metadata,
    });

    return NextResponse.json({ ok: true, relation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "奖励发放失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
