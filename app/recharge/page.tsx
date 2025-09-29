import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

export const dynamic = "force-dynamic";



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
  const qr = typeof sp.qr === "string" ? sp.qr : undefined;

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
    const provider = String(formData.get("provider") ?? "");
    if (amount <= 0) {
      redirect("/recharge?status=invalid_amount");
    }
    if (provider !== "alipay") {
      // 微信暂未接入，其他情况均视为未选择有效支付方式
      redirect("/recharge?status=invalid_provider");
    }

    // 创建支付宝预下单，返回二维码
    const createRes = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/payments/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        amount,
        provider: "alipay",
        metadata: { note: "alipay recharge" },
      }),
    });

    if (!createRes.ok) {
      redirect("/recharge?status=create_failed");
    }

    const createJson = await createRes.json();
    const transaction = createJson.transaction;
    const qrCode = createJson.qr_code ?? createJson.qrCode;
    if (!transaction?.id || !qrCode) {
      redirect("/recharge?status=create_failed");
    }

    // 跳回充值页，展示二维码，等待用户扫码。支付成功后由 webhook 入账。
    redirect(`/recharge?status=pending&tid=${transaction.id}&amount=${amount}&qr=${encodeURIComponent(qrCode)}`);
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
        <div className="pt-2 space-x-2">
          <Button type="submit" name="provider" value="alipay">使用支付宝支付</Button>
          <Button type="button" disabled className="opacity-60 cursor-not-allowed">微信（暂未接入）</Button>
        </div>
      </form>

      {status && (
        <section className="rounded-lg border p-4">
          <div className="text-sm text-gray-500 mb-2">订单状态</div>
          {status === "ok" ? (
            <div className="text-green-600">
              充值成功！交易ID：{tid}，金额：{amount} CNY
            </div>
          ) : status === "pending" ? (
            <div className="space-y-3">
              <div>请使用支付宝扫码完成支付：订单ID {tid}，金额 {amount} CNY</div>
              {qr ? (
                <img
                  alt="支付宝支付二维码"
                  className="border rounded"
                  width="240"
                  height="240"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${qr}`}
                />
              ) : (
                <div className="text-gray-600">二维码生成中... 如未显示，请刷新页面。</div>
              )}
              <div className="text-sm text-gray-500">支付完成后系统将通过支付宝通知自动入账，届时刷新本页即可看到成功状态。</div>
            </div>
          ) : status === "invalid_amount" ? (
            <div className="text-red-600">金额无效，请输入大于 0 的数字。</div>
          ) : status === "invalid_provider" ? (
            <div className="text-red-600">请选择支付宝方式进行支付。</div>
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