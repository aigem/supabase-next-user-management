import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import type { Product } from "./(store)/products";
import { demoProducts } from "./(store)/products";

async function createPayment(amount: number) {
  "use server";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "请先登录", paymentUrl: null };
  }
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/payments/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    return { ok: false, error: data?.error ?? "创建订单失败", paymentUrl: null };
  }
  return { ok: true, error: null, paymentUrl: data.paymentUrl ?? null };
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">精选商品</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">高质量 AI 能力服务，按需购买即用。</p>
        </div>
        {user ? (
          <Link href="/account" className="text-sm text-blue-600 underline">账户中心</Link>
        ) : (
          <Link href="/login" className="text-sm text-blue-600 underline">登录/注册</Link>
        )}
      </header>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {demoProducts.map((p: Product) => (
          <form
            key={p.id}
            action={async () => {
              "use server";
              const result = await createPayment(p.price);
              if (!result.ok) {
                return;
              }
              // 服务端无法直接在此打开新窗口，交由客户端点击链接；这里返回到 UI 由用户点击
            }}
            className="rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden flex flex-col"
          >
            <div className="relative aspect-[4/3]">
              <Image
                src={p.image}
                alt={p.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 25vw"
              />
            </div>
            <div className="p-4 flex flex-col gap-2">
              <div className="text-base font-semibold">{p.title}</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-400">{p.subtitle}</div>
              <div className="mt-1 text-lg font-bold text-blue-600">¥{p.price.toFixed(2)}</div>
              {user ? (
                <Link
                  href={`/api/payments/create?amount=${encodeURIComponent(p.price)}`}
                  className="mt-2 inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 text-sm hover:bg-blue-700"
                >
                  购买
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="mt-2 inline-flex items-center justify-center rounded bg-blue-600 text-white px-3 py-2 text-sm hover:bg-blue-700"
                >
                  登录后购买
                </Link>
              )}
            </div>
          </form>
        ))}
      </section>

      <section className="rounded-lg border p-4 bg-white dark:bg-zinc-900">
        <h2 className="text-lg font-semibold mb-2">为什么选择我们</h2>
        <ul className="list-disc pl-5 text-sm space-y-1 text-neutral-700 dark:text-neutral-300">
          <li>充值入账实时到账，支付链路已对接 XorPay 支付宝扫码</li>
          <li>账户余额统一管理，支持 API 调用原子扣费与用量日志</li>
          <li>清晰的报表与邀请奖励体系，适合个人与团队使用</li>
        </ul>
      </section>
    </div>
  );
}