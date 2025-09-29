import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Json = Record<string, unknown>;

function parseDate(input: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  return new Date(d).toISOString();
}

function toCSV(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "id,operation,units,unit_price,total_cost,created_at\n";
  const headers = ["id", "operation", "units", "unit_price", "total_cost", "created_at"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const vals = headers.map((h) => {
      const v = (r as any)[h];
      if (v == null) return "";
      const s = String(v);
      // Escape commas/quotes/newlines
      const needsQuote = /[",\n]/.test(s);
      return needsQuote ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(vals.join(","));
  }
  return lines.join("\n");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const limitParam = url.searchParams.get("limit");
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();

  const start = parseDate(startParam);
  const end = parseDate(endParam);

  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 近30天
  const from = start ?? defaultStart;
  const to = end ?? now;

  const limit = Math.min(Math.max(Number(limitParam ?? 500), 1), 5000); // 1..5000

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const query = supabase
    .from("usage_logs")
    .select("id, operation, units, unit_price, total_cost, created_at")
    .eq("user_id", user.id)
    .gte("created_at", toISO(from))
    .lte("created_at", toISO(to))
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const logs = data ?? [];

  if (format === "csv") {
    const csv = toCSV(logs as Array<Record<string, unknown>>);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  // 聚合统计
  const summary = logs.reduce(
    (acc, cur) => {
      const units = Number(cur.units ?? 0);
      const cost = Number(cur.total_cost ?? 0);
      acc.totalCalls += 1;
      acc.totalUnits += units;
      acc.totalCost = Number((acc.totalCost + cost).toFixed(2));
      return acc;
    },
    { totalCalls: 0, totalUnits: 0, totalCost: 0 }
  );

  const byOperationMap: Record<
    string,
    { calls: number; units: number; cost: number }
  > = {};

  for (const cur of logs) {
    const op = String(cur.operation ?? "unknown");
    const units = Number(cur.units ?? 0);
    const cost = Number(cur.total_cost ?? 0);
    if (!byOperationMap[op]) {
      byOperationMap[op] = { calls: 0, units: 0, cost: 0 };
    }
    byOperationMap[op].calls += 1;
    byOperationMap[op].units += units;
    byOperationMap[op].cost = Number((byOperationMap[op].cost + cost).toFixed(2));
  }

  const byOperation = Object.entries(byOperationMap).map(([operation, v]) => ({
    operation,
    calls: v.calls,
    units: v.units,
    cost: v.cost,
  }));

  return NextResponse.json({
    userId: user.id,
    range: { start: toISO(from), end: toISO(to) },
    limit,
    summary,
    byOperation,
    logs,
  });
}