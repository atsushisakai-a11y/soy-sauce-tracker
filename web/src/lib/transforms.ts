import type { PriceRow } from "@/app/api/prices/route";

/** Short display label — strip brand prefix, keep size */
export function shortName(name: string): string {
  return name
    .replace(/^kikkoman\s*/i, "")
    .replace(/naturally brewed\s*/i, "")
    .trim()
    .replace(/\b(\d+)\s*ml\b/i, "$1ml");
}

/** All distinct product names sorted by latest avg price desc */
export function productNames(rows: PriceRow[]): string[] {
  const latest = new Map<string, number>();
  for (const r of rows) {
    const prev = latest.get(r.product_name) ?? "";
    if (!prev || r.scrape_month > prev) {
      latest.set(r.product_name, r.avg_price_eur);
    }
  }
  return [...latest.keys()].sort(
    (a, b) => (latest.get(b) ?? 0) - (latest.get(a) ?? 0)
  );
}

/** Pivot rows → [{ month, [productName]: avgPrice }] for the trend line chart */
export function pivotForTrend(
  rows: PriceRow[]
): Array<Record<string, string | number>> {
  const byMonth = new Map<string, Record<string, string | number>>();
  for (const r of rows) {
    if (!byMonth.has(r.scrape_month)) {
      byMonth.set(r.scrape_month, { month: r.scrape_month });
    }
    byMonth.get(r.scrape_month)![r.product_name] = r.avg_price_eur;
  }
  return [...byMonth.values()].sort((a, b) =>
    (a.month as string).localeCompare(b.month as string)
  );
}

/** Latest month rows only, sorted by avg price desc */
export function latestMonthRows(rows: PriceRow[]): PriceRow[] {
  if (!rows.length) return [];
  const latest = rows.reduce((m, r) => (r.scrape_month > m ? r.scrape_month : m), "");
  return rows
    .filter((r) => r.scrape_month === latest)
    .sort((a, b) => b.avg_price_eur - a.avg_price_eur);
}

/** Global scorecards across all data */
export function scorecards(rows: PriceRow[]) {
  if (!rows.length)
    return { avgPrice: 0, cheapest: 0, mostExpensive: 0, products: 0, shops: 0, lastUpdated: "—" };
  const latest = latestMonthRows(rows);
  return {
    avgPrice:      +(latest.reduce((s, r) => s + r.avg_price_eur, 0) / latest.length).toFixed(2),
    cheapest:      Math.min(...latest.map((r) => r.min_price_eur)),
    mostExpensive: Math.max(...latest.map((r) => r.max_price_eur)),
    products:      latest.length,
    shops:         Math.max(...latest.map((r) => r.shop_count)),
    lastUpdated:   latest[0]?.scrape_month ?? "—",
  };
}

/** Chart colour palette — soy-sauce-inspired ambers + earthy tones */
export const CHART_COLORS = [
  "#d97706", // amber-500
  "#b45309", // amber-700
  "#ea580c", // orange-600
  "#92400e", // amber-800
  "#f59e0b", // amber-400
  "#dc2626", // red-600
  "#65a30d", // lime-600
  "#0891b2", // cyan-600
  "#7c3aed", // violet-600
  "#db2777", // pink-600
];
