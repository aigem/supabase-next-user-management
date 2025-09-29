import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createHmac } from "node:crypto";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

export const dynamic = "force-dynamic";

function makeSignature(body: string) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("缺少 PAYMENT_WEBHOOK_SECRET 环境变量");
  }
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

export default async function RechargePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const sp = (await searchParams) ?? {};
  const status = typeof sp.status === "string" ? sp.status : undefined;
  const tid = typeof sp.tid === "string" ? sp.tid : undefined;
  const amount = typeof sp.amount === "string" ? sp.amount : undefined;

  async function submitAction(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login");
    }

    const rawAmount = Number(formData.get("amount") ?? 0);
    const amount = Number.isFinite(rawAmount) ? Number(rawAmount.toFixed(2)) : 0;
    if (amount <= 0) {
      redirect("/recharge?status=invalid_amount");
    }

    // 1) 创建 pending 交易
    const createRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/payments/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        amount,
        provider: "mockpay",
        metadata: { note: "mock checkout" },
      }),
    });

    if (!createRes.ok) {
      redirect("/recharge?status=create_failed");
    }

    const createJson = await createRes.json();
    const transaction = createJson.transaction;
    if (!transaction?.id) {
      redirect("/recharge?status=create_failed");
    }

    // 2) 模拟支付网关成功回调（带签名）
    const webhookEvent = {
      transactionId: transaction.id,
      providerTransactionId: `mock_${Date.now()}`,
      status: "succeeded",
      amount,
      metadata: { channel: "mock" },
    };

    const body = JSON.stringify(webhookEvent);
    const signature = makeSignature(body);

    const webhookRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/payments/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-payment-signature": signature,
      },
      body,
    });

    if (!webhookRes.ok) {
      redirect(`/recharge?status=webhook_failed&tid=${transaction.id}&amount=${amount}`);
    }

    // 3) 回到充值页展示结果
    redirect(`/recharge?status=ok&tid=${transaction.id}&amount=${amount}`);
  }

  if (!user) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">充值</h1>
        <p>请先登录后再进行充值。</p>
        <Link href="/login" className="text-blue-600 underline">前往登录</Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">充值</h1>
        <Link href="/" className="text-sm text-blue-600 underline">返回主页</Link>
      </header>

      <form action={submitAction} className="rounded-lg border p-4 space-y-3">
        <label className="block text-sm text-gray-600">充值金额（CNY）</label>
        <input
          type="number"
          name="amount"
          min="1"
          step="0.01"
          placeholder="100"
          className="w-64 rounded border px-3 py-2"
          required
        />
        <div>
          <Button type="submit">创建订单并入账（Mock）</Button>
        </div>
      </form>

      {status && (
        <section className="rounded-lg border p-4">
          <div className="text-sm text-gray-500 mb-2">订单状态</div>
          {status === "ok" ? (
            <div className="text-green-600">
              充值成功！交易ID：{tid}，金额：{amount} CNY
            </div>
          ) : status === "invalid_amount" ? (
            <div className="text-red-600">金额无效，请输入大于 0 的数字。</div>
          ) : status === "create_failed" ? (
            <div className="text-red-600">创建订单失败，请稍后重试。</div>
          ) : status === "webhook_failed" ? (
            <div className="text-red-600">回调入账失败。交易ID：{tid}，金额：{amount} CNY</div>
          ) : (
            <div className="text-gray-600">状态：{status}</div>
          )}
        </section>
      )}
    </div>
  );
}