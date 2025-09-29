import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">欢迎</h1>
        <p>请先登录以查看余额与最近使用。</p>
        <Link href="/login" className="text-blue-600 underline">前往登录</Link>
      </div>
    );
  }

  const [billingRes, logsRes] = await Promise.all([
    supabase
      .from("billing_accounts")
      .select("user_id, balance, currency, updated_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("usage_logs")
      .select("id, operation, units, unit_price, total_cost, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const billing = billingRes.data ?? { balance: 0, currency: "CNY", updated_at: "" };
  const logs = logsRes.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">控制面板</h1>
        <Link href="/account" className="text-sm text-blue-600 underline">账户中心</Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">当前余额</div>
          <div className="mt-2 text-3xl font-semibold">
            {Number(billing.balance ?? 0).toFixed(2)} {billing.currency ?? "CNY"}
          </div>
          <div className="mt-1 text-xs text-gray-500">更新于：{billing.updated_at ? new Date(billing.updated_at).toLocaleString() : "-"}</div>
          <div className="mt-3">
            <Link href="/recharge" className="text-blue-600 underline">充值</Link>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">快捷入口</div>
          <div className="mt-2">
            <Link href="/console" className="text-blue-600 underline">图像/视频生成控制台</Link>
          </div>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <div className="text-sm text-gray-500 mb-2">最近使用</div>
        <ul className="space-y-2">
          {logs.length === 0 ? (
            <li className="text-sm text-gray-500">暂无使用记录</li>
          ) : (
            logs.map((item) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span>{item.operation} × {item.units}</span>
                <span>
                  {Number(item.total_cost ?? 0).toFixed(2)} CNY
                  <span className="ml-2 text-gray-500">{new Date(item.created_at).toLocaleString()}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
