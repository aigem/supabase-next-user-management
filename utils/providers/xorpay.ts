import { createHash } from "node:crypto"

type KV = Record<string, string>

/**
 * Build MD5 signature: md5(name + pay_type + price + order_id + notify_url + app_secret)
 * Pure value concat (no + or &), per XorPay doc.
 */
function md5Concat(values: string[]): string {
  const content = values.join("")
  const h = createHash("md5")
  h.update(content, "utf8")
  return h.digest("hex").toLowerCase()
}

function toForm(params: KV): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    usp.append(k, v)
  }
  return usp.toString()
}

/**
 * Precreate payment via XorPay.
 * Env:
 * - XORPAY_AID
 * - XORPAY_APP_SECRET
 * - XORPAY_NOTIFY_URL
 * - XORPAY_BASE_URL (optional, defaults https://xorpay.com)
 */
export async function precreate(input: {
  orderId: string
  name: string
  price: string // "50.00"
  orderUid?: string
  expire?: number
}): Promise<{ qrCode: string; aoid?: string; expiresIn?: number }> {
  const aid = process.env.XORPAY_AID
  const secret = process.env.XORPAY_APP_SECRET
  const notifyUrl = process.env.XORPAY_NOTIFY_URL
  const base = process.env.XORPAY_BASE_URL || "https://xorpay.com"

  if (!aid || !secret || !notifyUrl) {
    throw new Error("缺少 XORPAY_AID / XORPAY_APP_SECRET / XORPAY_NOTIFY_URL 环境变量")
  }

  const name = input.name
  const pay_type = "alipay"
  const price = input.price
  const order_id = input.orderId

  const sign = md5Concat([name, pay_type, price, order_id, notifyUrl, secret])

  const body: KV = {
    pay_type,
    name,
    price,
    order_id,
    notify_url: notifyUrl,
    sign,
  }
  if (input.orderUid) body["order_uid"] = input.orderUid
  if (input.expire) body["expire"] = String(input.expire)

  const url = `${base}/api/pay/${aid}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: toForm(body),
  })

  const json = await res.json().catch(() => null) as any
  if (!json || typeof json.status !== "string") {
    throw new Error("XorPay 响应异常")
  }
  if (json.status !== "ok") {
    const info = typeof json.info === "string" ? json.info : JSON.stringify(json.info)
    throw new Error(`XorPay 预下单失败: ${json.status}${info ? " - " + info : ""}`)
  }

  const qr = json.info?.qr as string | undefined
  if (!qr) throw new Error("XorPay 未返回二维码链接")

  return { qrCode: qr, aoid: json.aoid as string | undefined, expiresIn: json.expires_in as number | undefined }
}

/**
 * Verify XorPay notify signature:
 * md5(aoid + order_id + pay_price + pay_time + app_secret)
 * Body: application/x-www-form-urlencoded
 */
export function verifyNotify(rawBody: string): { ok: boolean; payload?: Record<string, string> } {
  const secret = process.env.XORPAY_APP_SECRET
  if (!secret) return { ok: false }

  let parsed: Record<string, string> = {}
  try {
    parsed = Object.fromEntries(new URLSearchParams(rawBody)) as Record<string, string>
  } catch {
    return { ok: false }
  }

  const aoid = parsed.aoid
  const order_id = parsed.order_id
  const pay_price = parsed.pay_price
  const pay_time = parsed.pay_time
  const sign = parsed.sign

  if (!aoid || !order_id || !pay_price || !pay_time || !sign) {
    return { ok: false }
  }

  const expect = md5Concat([aoid, order_id, pay_price, pay_time, secret])
  const ok = expect === (sign?.toLowerCase() ?? "")
  return { ok, payload: ok ? parsed : undefined }
}