import { NextResponse } from "next/server";
import { getBillingAccount, chargeUsage } from "@/utils/billing";

interface DeductBody {
  userId?: string;
  operation?: string;
  units?: number;
  unitPrice?: number;
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

  let body: DeductBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const userId = body.userId ?? "";
  const operation = body.operation ?? "unknown";
  const units = Number(body.units ?? 1);
  const unitPrice = Number(body.unitPrice ?? 0);

  if (!userId) {
    return NextResponse.json({ error: "缺少 userId" }, { status: 400 });
  }

  if (!Number.isFinite(units) || units <= 0) {
    return NextResponse.json({ error: "无效的 units" }, { status: 400 });
  }

  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return NextResponse.json({ error: "无效的 unitPrice" }, { status: 400 });
  }

  const totalCost = Number((units * unitPrice).toFixed(2));

  try {
    const newBalance = await chargeUsage({
      userId,
      operation,
      units,
      unitPrice,
      metadata: body.metadata,
    });

    return NextResponse.json({
      ok: true,
      balance: newBalance,
      currency: "CNY",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "扣费失败";

    // Handle insufficient funds specially by returning 422 and current balance
    if (message.includes("INSUFFICIENT_FUNDS")) {
      try {
        const account = await getBillingAccount(userId);
        return NextResponse.json(
          {
            error: "余额不足",
            balance: account?.balance ?? 0,
          },
          { status: 422 }
        );
      } catch {
        // fall through to generic error
      }
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
