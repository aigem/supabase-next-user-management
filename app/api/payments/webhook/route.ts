import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getTransactionById,
  updateTransactionStatus,
  type PaymentStatus,
} from "@/utils/payments";
import { incrementUserBalance } from "@/utils/billing";

interface PaymentWebhookEvent {
  transactionId: string;
  providerTransactionId?: string;
  status: PaymentStatus;
  amount?: number;
  userId?: string;
  metadata?: Record<string, unknown>;
}

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("缺少 PAYMENT_WEBHOOK_SECRET 环境变量");
  }

  if (!signature) {
    return false;
  }

  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return signature === digest;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  let event: PaymentWebhookEvent;
  try {
    const signature =
      request.headers.get("x-payment-signature") ?? request.headers.get("x-signature");
    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: "签名验证失败" }, { status: 401 });
    }

    event = JSON.parse(rawBody) as PaymentWebhookEvent;
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求解析失败";
    const status = message.includes("PAYMENT_WEBHOOK_SECRET") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
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
