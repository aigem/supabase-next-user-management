import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createPendingTransaction } from "@/utils/payments";
import { precreate as xorpayPrecreate } from "@/utils/providers/xorpay";

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

  const provider = payload.provider ?? "alipay";

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

    if (provider === "alipay") {
      // Use XorPay to precreate an Alipay QR payment, order_id uses our transaction id
      const orderId = transaction.id
      const { qrCode, aoid } = await xorpayPrecreate({
        orderId,
        name: "账户充值",
        price: Number(amount.toFixed(2)).toFixed(2),
      })

      return NextResponse.json({
        transaction: {
          ...transaction,
          provider_transaction_id: aoid ?? orderId,
          metadata: {
            ...(transaction.metadata ?? {}),
            qr_code: qrCode,
            xorpay_aoid: aoid,
          },
        },
        qrCode,
        provider: "alipay",
      })
    } else {
      return NextResponse.json({ error: "不支持的支付方式" }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建订单失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
