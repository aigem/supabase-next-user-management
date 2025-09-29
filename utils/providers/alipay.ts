import { createSign } from "node:crypto";

type KV = Record<string, string>;

function buildQuery(params: KV): string {
  const entries = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([k, v]) => `${k}=${v}`);
  return entries.join("&");
}

function rsa2Sign(content: string, privateKeyPem: string): string {
  const signer = createSign("RSA-SHA256");
  signer.update(content, "utf8");
  return signer.sign(privateKeyPem, "base64");
}

export function rsa2Verify(content: string, signature: string, alipayPublicKeyPem: string): boolean {
  try {
    const verifier = createSign("RSA-SHA256");
    // Note: For verification, use createVerify instead; but Next.js runtime allows crypto.verify via Web API?
    // Node.js: use crypto.createVerify
    const crypto = require("node:crypto") as typeof import("node:crypto");
    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(content, "utf8");
    return verify.verify(alipayPublicKeyPem, signature, "base64");
  } catch {
    return false;
  }
}

/**
 * Call alipay.trade.precreate to generate a QR code for payment.
 * Required env:
 * - ALIPAY_APP_ID
 * - ALIPAY_APP_PRIVATE_KEY (PEM, begins with -----BEGIN PRIVATE KEY-----)
 * - ALIPAY_GATEWAY (e.g. https://openapi.alipay.com/gateway.do)
 * - ALIPAY_NOTIFY_URL (your vercel domain + /api/payments/webhook)
 */
export async function precreate(input: {
  outTradeNo: string;
  subject: string;
  totalAmount: string; // string decimal, e.g. "100.00"
  storeId?: string;
  timeoutExpress?: string;
}) {
  const appId = process.env.ALIPAY_APP_ID!;
  const gateway = process.env.ALIPAY_GATEWAY || "https://openapi.alipay.com/gateway.do";
  const privateKey = process.env.ALIPAY_APP_PRIVATE_KEY!;
  const notifyUrl = process.env.ALIPAY_NOTIFY_URL!;

  if (!appId || !privateKey || !notifyUrl) {
    throw new Error("缺少 ALIPAY_APP_ID / ALIPAY_APP_PRIVATE_KEY / ALIPAY_NOTIFY_URL 环境变量");
  }

  const bizContent = {
    out_trade_no: input.outTradeNo,
    subject: input.subject,
    total_amount: input.totalAmount,
    store_id: input.storeId ?? "",
    timeout_express: input.timeoutExpress ?? "30m",
  };

  const common: KV = {
    app_id: appId,
    method: "alipay.trade.precreate",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
    version: "1.0",
    notify_url: notifyUrl,
    biz_content: JSON.stringify(bizContent),
  };

  const toSign = buildQuery(common);
  const sign = rsa2Sign(toSign, privateKey);
  const requestKV: KV = { ...common, sign };

  const form = new URLSearchParams(requestKV);
  const res = await fetch(gateway, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: form.toString(),
  });

  const json = await res.json().catch(() => null) as any;
  if (!json || !json.alipay_trade_precreate_response) {
    throw new Error("支付宝预创建响应异常");
  }

  const resp = json.alipay_trade_precreate_response;
  if (resp.code !== "10000") {
    throw new Error(`支付宝预创建失败: ${resp.code} ${resp.msg}`);
  }

  // resp contains: out_trade_no, qr_code
  return { outTradeNo: resp.out_trade_no as string, qrCode: resp.qr_code as string };
}

/**
 * Verify notify payload from Alipay (RSA2).
 * Provide the raw body string and signature from 'sign' field.
 * Rebuild the sign content by excluding 'sign' and 'sign_type' and sorting fields.
 */
export function verifyNotify(rawBody: string): { ok: boolean; payload?: Record<string, any> } {
  const pub = process.env.ALIPAY_ALIPAY_PUBLIC_KEY;
  if (!pub) return { ok: false };

  // Parse x-www-form-urlencoded or JSON
  let parsed: Record<string, any> = {};
  try {
    // Alipay notify default is form POST (application/x-www-form-urlencoded)
    // Attempt to parse as URLSearchParams first
    parsed = Object.fromEntries(new URLSearchParams(rawBody)) as any;
    if (Object.keys(parsed).length === 0) {
      parsed = JSON.parse(rawBody);
    }
  } catch {
    // Fallback: try querystring
    const qs = require("node:querystring");
    parsed = qs.parse(rawBody) as any;
  }

  const signature = parsed.sign as string | undefined;
  const signType = parsed.sign_type as string | undefined;

  if (!signature || (signType && signType.toUpperCase() !== "RSA2")) {
    return { ok: false };
  }

  // Build content to verify
  const sortedEntries = Object.entries(parsed)
    .filter(([k]) => k !== "sign" && k !== "sign_type")
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([k, v]) => `${k}=${v as string}`);
  const signContent = sortedEntries.join("&");

  const ok = rsa2Verify(signContent, signature, pub);
  return { ok, payload: ok ? parsed : undefined };
}