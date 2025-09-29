import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createPendingTransaction } from "@/utils/payments";

interface CreatePaymentBody {
  amount?: number;
  provider?: string;
  metadata?: Record<string, unknown>;
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

  let payload: CreatePaymentBody;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  const amount = Number(payload.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "充值金额必须大于 0" }, { status: 400 });
  }

  const provider = payload.provider ?? process.env.PAYMENT_PROVIDER_NAME ?? "mockpay";

  try {
    const transaction = await createPendingTransaction({
      userId: user.id,
      provider,
      amount: Number(amount.toFixed(2)),
      metadata: {
        ...payload.metadata,
        createdBy: user.id,
      },
    });

    const checkoutBase = process.env.PAYMENT_CHECKOUT_ENDPOINT ?? "https://pay.example.com/checkout";
    const paymentUrl = `${checkoutBase}?transaction_id=${transaction.id}`;

    return NextResponse.json({
      transaction,
      paymentUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建订单失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
