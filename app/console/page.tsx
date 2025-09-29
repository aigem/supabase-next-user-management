import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function ApiConsolePage({
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
  const msg = typeof sp.msg === "string" ? sp.msg : undefined;
  const balance = typeof sp.balance === "string" ? sp.balance : undefined;

  async function chargeAction(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login");
    }

    const operation = String(formData.get("operation") ?? "generate_image");
    const unitsRaw = Number(formData.get("units") ?? 1);
    const unitPriceRaw = Number(formData.get("unitPrice") ?? 0);

    const units = Number.isFinite(unitsRaw) && unitsRaw > 0 ? Math.floor(unitsRaw) : 1;
    const unitPrice = Number.isFinite(unitPriceRaw) && unitPriceRaw >= 0 ? Number(unitPriceRaw.toFixed(4)) : 0;

    const origin = (process.env.NEXT_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    const token = process.env.INTERNAL_API_KEY;
    if (!token) {
      redirect(`/console?status=error&msg=${encodeURIComponent("缺少 INTERNAL_API_KEY 环境变量")}`);
    }

    const res = await fetch(`${origin}/api/billing/deduct`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": token!,
      },
      body: JSON.stringify({
        userId: user.id,
        operation,
        units,
        unitPrice,
        metadata: { console: true },
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = typeof json?.error === "string" ? json.error : `扣费失败(${res.status})`;
      // 若余额不足则带回当前余额
      if (res.status === 422 && typeof json?.balance !== "undefined") {
        redirect(`/console?status=insufficient&msg=${encodeURIComponent(message)}&balance=${encodeURIComponent(String(json.balance))}`);
      }
      redirect(`/console?status=error&msg=${encodeURIComponent(message)}`);
    }

    const newBalance = typeof json?.balance !== "undefined" ? String(json.balance) : "";
    redirect(`/console?status=ok&balance=${encodeURIComponent(newBalance)}`);
  }

  if (!user) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">API 控制台</h1>
        <p>请先登录后再进行调用与扣费。</p>
        <Link href="/login" className="text-blue-600 underline">前往登录</Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">API 控制台（演示）</h1>
        <Link href="/" className="text-sm text-blue-600 underline">返回主页</Link>
      </header>

      <section className="rounded-lg border p-4 space-y-3">
        <div className="text-sm text-gray-500">参数表单（仅用于费用估算与扣费演示）</div>
        <form action={chargeAction} className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="block text-xs text-gray-600">操作名</label>
            <input
              type="text"
              name="operation"
              defaultValue="generate_image"
              className="w-full rounded border px-3 py-2"
              placeholder="generate_image / generate_video"
              required
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs text-gray-600">调用次数（units）</label>
            <input
              type="number"
              name="units"
              min="1"
              step="1"
              defaultValue={1}
              className="w-full rounded border px-3 py-2"
              required
            />
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs text-gray-600">单价（CNY）</label>
            <input
              type="number"
              name="unitPrice"
              min="0"
              step="0.01"
              defaultValue={0.5}
              className="w-full rounded border px-3 py-2"
              required
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit">扣费演示</Button>
          </div>
        </form>
        <p className="text-xs text-gray-500">提示：此页面不会调用实际模型，仅用于估算与扣费联动。</p>
      </section>

      {status && (
        <section className="rounded-lg border p-4">
          <div className="text-sm text-gray-500 mb-2">结果</div>
          {status === "ok" ? (
            <div className="text-green-600">
              扣费成功！新余额：{balance ? Number(balance).toFixed(2) : "-"} CNY
            </div>
          ) : status === "insufficient" ? (
            <div className="text-red-600">
              余额不足。当前余额：{balance ? Number(balance).toFixed(2) : "-"} CNY
            </div>
          ) : (
            <div className="text-red-600">{msg ?? "扣费失败"}</div>
          )}
        </section>
      )}
    </div>
  );
}