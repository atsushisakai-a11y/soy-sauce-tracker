"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import type { BrandRow, ShopRow } from "@/app/page";
import { CHART_COLORS } from "@/lib/transforms";

type Props = { byBrand: BrandRow[]; byShop: ShopRow[] };

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function CustomTooltip({
  active, payload, label, subtitle,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: Record<string, number> }>;
  label?: string;
  subtitle: (p: Record<string, number>) => string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-lg p-3 text-xs max-w-[200px]">
      <p className="font-semibold text-stone-800 mb-1">{label}</p>
      <p className="text-stone-600">Avg <strong>{fmt(payload[0].value)}</strong> / 100ml</p>
      <p className="text-stone-400 mt-1">{subtitle(p)}</p>
    </div>
  );
}

function HorizontalBar<T extends Record<string, unknown>>({
  title, subtitle, data, nameKey, tooltipSubtitle,
}: {
  title: string;
  subtitle: string;
  data: T[];
  nameKey: keyof T;
  tooltipSubtitle: (row: Record<string, number>) => string;
}) {
  // Data is already latest-month-only from the datamart — just sort
  const latestMonth = data.length > 0 ? (data[0].scrape_month as string) : "";
  const chartData = [...data]
    .sort((a, b) => (a.avg_price_per_100ml as number) - (b.avg_price_per_100ml as number))
    .map((r) => ({
    ...r,
    name: r[nameKey] as string,
    value: r.avg_price_per_100ml as number,
  }));

  const chartHeight = Math.max(200, chartData.length * 34 + 40);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
      <h2 className="text-base font-semibold text-stone-800 mb-1">{title}</h2>
      <p className="text-xs text-stone-400 mb-4">{subtitle} · {latestMonth}</p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 80, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v) => `€${v.toFixed(2)}`}
            tick={{ fontSize: 10, fill: "#78716c" }}
            tickLine={false}
            axisLine={{ stroke: "#e7e5e4" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={115}
            tick={{ fontSize: 11, fill: "#44403c" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<CustomTooltip subtitle={tooltipSubtitle} />}
            cursor={{ fill: "#f5f5f4" }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: number) => `€${v.toFixed(2)}`}
              style={{ fontSize: 11, fill: "#78716c", fontWeight: 500 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Price100mlChart({ byBrand, byShop }: Props) {
  if (!byBrand.length && !byShop.length) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <HorizontalBar<BrandRow>
        title="Best Value — by Brand"
        subtitle="Avg €/100ml · cheapest first"
        data={byBrand}
        nameKey="brand"
        tooltipSubtitle={(p) =>
          `${p.product_count} products · ${p.shop_count} shops`
        }
      />
      <HorizontalBar<ShopRow>
        title="Best Value — by Shop"
        subtitle="Avg €/100ml · cheapest first"
        data={byShop}
        nameKey="shop_name"
        tooltipSubtitle={(p) =>
          `${p.product_count} products · ${p.brand_count} brands`
        }
      />
    </div>
  );
}
