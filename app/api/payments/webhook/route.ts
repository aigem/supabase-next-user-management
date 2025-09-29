import { NextResponse } from "next/server";
import {
  getTransactionById,
  updateTransactionStatus,
  type PaymentStatus,
} from "@/utils/payments";
import { incrementUserBalance } from "@/utils/billing";
import { verifyNotify as verifyXorpayNotify } from "@/utils/providers/xorpay";

interface PaymentWebhookEvent {
  transactionId: string;
  providerTransactionId?: string;
  status: PaymentStatus;
  amount?: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

function verifySignature(rawBody: string): { ok: boolean; payload?: any } {
  // 仅支持 XorPay 表单通知验签
  const vx = verifyXorpayNotify(rawBody);
  if (vx.ok) return { ok: true, payload: vx.payload };
  return { ok: false };
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  let event: PaymentWebhookEvent;
  try {
    const verify = verifySignature(rawBody);
    if (!verify.ok || !verify.payload) {
      return NextResponse.json({ error: "签名验证失败" }, { status: 401 });
    }

    const p = verify.payload as Record<string, string>;
    // 映射 XorPay 通知到内部事件
    event = {
      transactionId: String(p.order_id ?? ""),
      providerTransactionId: String(p.transaction_id ?? ""),
      status: "succeeded",
      amount: Number(p.pay_price ?? 0),
      userId: undefined,
      metadata: p,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求解析失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!event.transactionId) {
    return NextResponse.json({ error: "缺少 transactionId" }, { status: 400 });
  }

  if (!event.status) {
    return NextResponse.json({ error: "缺少 status" }, { status: 400 });
  }

  const transaction = await getTransactionById(event.transactionId);

  if (!transaction) {
    return NextResponse.json({ error: "交易不存在" }, { status: 404 });
  }

  if (transaction.status !== "pending") {
    return NextResponse.json({ ok: true, transaction }, { status: 200 });
  }

  const mergedMetadata = {
    ...(transaction.metadata ?? {}),
    ...event.metadata,
    providerTransactionId: event.providerTransactionId,
  };

  try {
    const updated = await updateTransactionStatus({
      id: transaction.id,
      status: event.status,
      providerTransactionId: event.providerTransactionId,
      metadata: mergedMetadata,
      expectedStatus: "pending",
    });

    if (event.status === "succeeded") {
      const amount = Number(event.amount ?? updated.amount);
      await incrementUserBalance(transaction.user_id, amount, {
        actorId: transaction.user_id,
        metadata: {
          reason: "payment_top_up",
          transactionId: transaction.id,
          providerTransactionId: event.providerTransactionId,
        },
      });
    }

    return NextResponse.json({ ok: true, transaction: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "交易状态已更新") {
      const latest = await getTransactionById(transaction.id);
      return NextResponse.json({ ok: true, transaction: latest ?? transaction }, { status: 200 });
    }
    const message = error instanceof Error ? error.message : "更新交易失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
