import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { registerInviteRelation } from "@/utils/invites";

interface RegisterBody {
  inviterId?: string;
  rewardAmount?: number;
}

export async function POST(request: Request) {
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

  let body: RegisterBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const inviterId = body.inviterId ?? "";

  if (!inviterId) {
    return NextResponse.json({ error: "缺少 inviterId" }, { status: 400 });
  }

  if (inviterId === user.id) {
    return NextResponse.json({ error: "不能邀请自己" }, { status: 400 });
  }

  try {
    const relation = await registerInviteRelation({
      inviterId,
      inviteeId: user.id,
      rewardAmount: body.rewardAmount,
    });

    return NextResponse.json({ ok: true, relation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "邀请绑定失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
