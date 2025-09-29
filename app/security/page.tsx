import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import Button from "@/app/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">账户与安全</h1>
        <div className="text-red-600">会话错误：{authError.message}</div>
        <Link href="/" className="text-blue-600 underline">返回主页</Link>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">账户与安全</h1>
        <p>未登录，仅登录用户可查看审计摘要与账户信息。</p>
        <Link href="/login" className="text-blue-600 underline">前往登录</Link>
      </div>
    );
  }

  const { data: auditLogs, error: auditError } = await supabase
    .from("audit_logs")
    .select("id, event, target_table, target_id, metadata, created_at")
    .eq("actor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">账户与安全</h1>
        <Link href="/" className="text-sm text-blue-600 underline">返回主页</Link>
      </header>

      <section className="rounded-lg border p-4">
        <div className="text-sm text-gray-500">我的账户</div>
        <div className="mt-2 text-sm">
          <div><span className="text-gray-500">用户ID：</span>{user.id}</div>
          <div><span className="text-gray-500">邮箱：</span>{user.email ?? "-"}</div>
          <div><span className="text-gray-500">登录状态：</span>已登录</div>
        </div>
        <div className="mt-3">
          <Button asLink href="/auth/signout">登出</Button>
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <div className="text-sm text-gray-500 mb-2">审计摘要（最近 20 条）</div>
        {auditError ? (
          <div className="text-red-600">加载失败：{auditError.message}</div>
        ) : (auditLogs ?? []).length === 0 ? (
          <div className="text-sm text-gray-500">暂无审计事件</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-2 py-1">时间</th>
                  <th className="px-2 py-1">事件</th>
                  <th className="px-2 py-1">目标表</th>
                  <th className="px-2 py-1">目标ID</th>
                  <th className="px-2 py-1">详情</th>
                </tr>
              </thead>
              <tbody>
                {(auditLogs ?? []).map((l) => (
                  <tr key={l.id}>
                    <td className="px-2 py-1">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-2 py-1">{l.event}</td>
                    <td className="px-2 py-1">{l.target_table ?? "-"}</td>
                    <td className="px-2 py-1">{l.target_id ?? "-"}</td>
                    <td className="px-2 py-1">
                      <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(l.metadata ?? {}, null, 2)}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 text-xs text-gray-500">
          注：该页面在数据库行级安全（RLS）下仅读取当前用户的审计事件。
        </div>
      </section>
    </div>
  );
}