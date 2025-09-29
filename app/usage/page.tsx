import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

export const dynamic = "force-dynamic";

function toISO(d: Date) {
  return new Date(d).toISOString();
}

function presetRange(preset: string | undefined) {
  const now = new Date();
  if (preset === "7d") {
    return { start: toISO(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), end: toISO(now) };
  }
  // default 30d
  return { start: toISO(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), end: toISO(now) };
}

export default async function UsagePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">使用报表</h1>
        <p>请先登录以查看使用统计与明细。</p>
        <Link href="/login" className="text-blue-600 underline">前往登录</Link>
      </div>
    );
  }

  const sp = (await searchParams) ?? {};
  const preset = typeof sp.preset === "string" ? sp.preset : undefined;
  const customStart = typeof sp.start === "string" ? sp.start : undefined;
  const customEnd = typeof sp.end === "string" ? sp.end : undefined;

  const { start, end } = customStart && customEnd ? { start: customStart, end: customEnd } : presetRange(preset);

  const origin = process.env.NEXT_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const base = origin.replace(/\/$/, "");
  const reportUrl = `${base}/api/usage/report?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&limit=500`;

  const res = await fetch(reportUrl, { headers: { "cache-control": "no-store" } });
  if (!res.ok) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">使用报表</h1>
        <div className="text-red-600">获取报表失败：{res.status}</div>
        <Link href="/" className="text-blue-600 underline">返回主页</Link>
      </div>
    );
  }

  const json = await res.json() as {
    range: { start: string; end: string };
    summary: { totalCalls: number; totalUnits: number; totalCost: number };
    byOperation: Array<{ operation: string; calls: number; units: number; cost: number }>;
    logs: Array<{ id: number; operation: string; units: number; unit_price: number; total_cost: number; created_at: string }>;
  };

  const csvUrl = `${base}/api/usage/report?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&limit=500&format=csv`;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">使用报表</h1>
        <Link href="/" className="text-sm text-blue-600 underline">返回主页</Link>
      </header>

      <section className="rounded-lg border p-4 space-y-3">
        <div className="text-sm text-gray-500">时间范围</div>
        <div className="flex items-center gap-3">
          <Link href="/usage?preset=7d" className="rounded border px-3 py-1">近7天</Link>
          <Link href="/usage?preset=30d" className="rounded border px-3 py-1">近30天</Link>
          <Button asLink href={csvUrl}>导出CSV</Button>
        </div>
        <div className="text-xs text-gray-500">
          当前范围：{new Date(json.range.start).toLocaleString()} ~ {new Date(json.range.end).toLocaleString()}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">总调用次数</div>
          <div className="mt-2 text-2xl font-semibold">{json.summary.totalCalls}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">总单位数</div>
          <div className="mt-2 text-2xl font-semibold">{json.summary.totalUnits}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm text-gray-500">总费用（CNY）</div>
          <div className="mt-2 text-2xl font-semibold">{Number(json.summary.totalCost ?? 0).toFixed(2)}</div>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <div className="text-sm text-gray-500 mb-2">按操作分组</div>
        <ul className="space-y-2">
          {json.byOperation.length === 0 ? (
            <li className="text-sm text-gray-500">暂无分组数据</li>
          ) : (
            json.byOperation.map((g) => (
              <li key={g.operation} className="flex justify-between text-sm">
                <span>{g.operation}</span>
                <span>调用 {g.calls} 次 · 单位 {g.units} · 费用 {Number(g.cost ?? 0).toFixed(2)} CNY</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-lg border p-4">
        <div className="text-sm text-gray-500 mb-2">明细（最多500条）</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-2 py-1">时间</th>
                <th className="px-2 py-1">操作</th>
                <th className="px-2 py-1">单位</th>
                <th className="px-2 py-1">单价</th>
                <th className="px-2 py-1">费用</th>
              </tr>
            </thead>
            <tbody>
              {json.logs.length === 0 ? (
                <tr><td className="px-2 py-2 text-gray-500" colSpan={5}>暂无记录</td></tr>
              ) : (
                json.logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-2 py-1">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-2 py-1">{l.operation}</td>
                    <td className="px-2 py-1">{l.units}</td>
                    <td className="px-2 py-1">{Number(l.unit_price ?? 0).toFixed(4)}</td>
                    <td className="px-2 py-1">{Number(l.total_cost ?? 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}