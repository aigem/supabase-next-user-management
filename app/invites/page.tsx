import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

export const dynamic = "force-dynamic";

function siteOrigin() {
  const siteUrl = process.env.NEXT_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return siteUrl.replace(/\/$/, "");
}

export default async function InvitesPage({
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
        <h1 className="text-xl font-semibold">邀请与奖励</h1>
        <p>请先登录以查看邀请数据与奖励。</p>
        <Link href="/login" className="text-blue-600 underline">前往登录</Link>
      </div>
    );
  }

  const sp = (await searchParams) ?? {};
  const inviterParam = typeof sp.inviter === "string" ? sp.inviter : undefined;

  async function bindInvite(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login");
    }

    const inviterId = (formData.get("inviterId") as string) || "";
    const amount = Number(formData.get("rewardAmount") ?? 0);
    const payload = {
      inviterId,
      rewardAmount: Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : undefined,
    };

    const origin = siteOrigin();
    const res = await fetch(`${origin}/api/invites/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      redirect(`/invites?status=bind_failed`);
    }
    redirect(`/invites?status=bind_ok`);
  }

  async function rewardInvite(formData: FormData) {
    "use server";

    const origin = siteOrigin();
    const inviterId = formData.get("inviterId") as string;
    const inviteeId = formData.get("inviteeId") as string;
    const amountRaw = Number(formData.get("amount") ?? 0);
    const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? Number(amountRaw.toFixed(2)) : 0;

    if (!inviterId || !inviteeId || amount <= 0) {
      redirect(`/invites?status=reward_invalid`);
    }

    const token = process.env.INTERNAL_API_KEY;
    if (!token) {
      redirect(`/invites?status=internal_key_missing`);
    }

    const res = await fetch(`${origin}/api/invites/reward`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": token!,
      },
      body: JSON.stringify({ inviterId, inviteeId, amount, metadata: { source: "manual_reward" } }),
    });

    if (!res.ok) {
      redirect(`/invites?status=reward_failed`);
    }
    redirect(`/invites?status=reward_ok`);
  }

  // 列表使用用户态 supabase（符合 RLS）
  const { data: relations, error } = await supabase
    .from("invite_relations")
    .select("inviter_id, invitee_id, reward_amount, status, created_at, rewarded_at")
    .or(`inviter_id.eq.${user.id},invitee_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(50);

  const inviteLink = siteOrigin() ? `${siteOrigin()}/login?inviter=${user.id}` : null;
  const statusMsg =
    typeof sp.status === "string" ? sp.status : undefined;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">邀请与奖励</h1>
        <Link href="/" className="text-sm text-blue-600 underline">返回主页</Link>
      </header>

      <section className="rounded-lg border p-4 space-y-2">
        <div className="text-sm text-gray-500">我的邀请链接</div>
        {inviteLink ? (
          <div className="flex items-center gap-3">
            <code className="rounded bg-gray-100 px-2 py-1">{inviteLink}</code>
            <a href={inviteLink} className="text-blue-600 underline" target="_blank">打开</a>
          </div>
        ) : (
          <div className="text-sm text-gray-500">未配置站点地址（NEXT_SITE_URL 或 NEXT_PUBLIC_SITE_URL）</div>
        )}
        <div className="text-xs text-gray-500">提示：受邀人登录/注册时携带 inviter 参数即可绑定关系。</div>
      </section>

      <section className="rounded-lg border p-4 space-y-3">
        <div className="text-sm text-gray-500">绑定邀请（演示）</div>
        <form action={bindInvite} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-600">邀请人ID（inviterId）</label>
            <input
              type="text"
              name="inviterId"
              defaultValue={inviterParam ?? ""}
              className="rounded border px-3 py-2 w-64"
              placeholder="对方用户ID"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600">奖励金额（可选）</label>
            <input
              type="number"
              name="rewardAmount"
              step="0.01"
              min="0"
              className="rounded border px-3 py-2 w-32"
              placeholder="5"
            />
          </div>
          <Button type="submit">绑定关系</Button>
        </form>
        {statusMsg && (
          <div className="text-xs text-gray-600">状态：{statusMsg}</div>
        )}
      </section>

      <section className="rounded-lg border p-4">
        <div className="text-sm text-gray-500 mb-2">邀请关系列表</div>
        {error ? (
          <div className="text-red-600">加载失败：{error.message}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-2 py-1">邀请人</th>
                  <th className="px-2 py-1">受邀人</th>
                  <th className="px-2 py-1">奖励金额</th>
                  <th className="px-2 py-1">状态</th>
                  <th className="px-2 py-1">创建时间</th>
                  <th className="px-2 py-1">发放时间</th>
                  <th className="px-2 py-1">操作</th>
                </tr>
              </thead>
              <tbody>
                {(relations ?? []).length === 0 ? (
                  <tr><td className="px-2 py-2 text-gray-500" colSpan={7}>暂无邀请记录</td></tr>
                ) : (
                  (relations ?? []).map((r) => (
                    <tr key={`${r.inviter_id}-${r.invitee_id}`}>
                      <td className="px-2 py-1">{r.inviter_id}</td>
                      <td className="px-2 py-1">{r.invitee_id}</td>
                      <td className="px-2 py-1">{Number(r.reward_amount ?? 0).toFixed(2)} CNY</td>
                      <td className="px-2 py-1">{r.status}</td>
                      <td className="px-2 py-1">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-2 py-1">{r.rewarded_at ? new Date(r.rewarded_at).toLocaleString() : "-"}</td>
                      <td className="px-2 py-1">
                        {r.status === "pending" ? (
                          <form action={rewardInvite} className="flex items-center gap-2">
                            <input type="hidden" name="inviterId" value={r.inviter_id} />
                            <input type="hidden" name="inviteeId" value={r.invitee_id} />
                            <input
                              type="number"
                              name="amount"
                              step="0.01"
                              min="0.01"
                              defaultValue={r.reward_amount ?? 5}
                              className="rounded border px-2 py-1 w-24"
                            />
                            <Button type="submit">发放奖励</Button>
                          </form>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}