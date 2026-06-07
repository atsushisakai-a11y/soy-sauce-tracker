"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { PriceRow } from "@/app/api/prices/route";
import { latestMonthRows } from "@/lib/transforms";
import { CHART_COLORS } from "@/lib/transforms";

type Props = { rows: PriceRow[] };

type BarEntry = { name: string; value: number; color: string };

function fmt(n: number) {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function CustomTooltip({
  active,
  payload,
  label,
  suffix,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  suffix: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-stone-800 mb-1">{label}</p>
      <p className="text-stone-500">
        Avg <strong className="text-stone-800">{fmt(payload[0].value)}</strong> / 100ml
      </p>
      <p className="text-stone-400 mt-0.5">{suffix}</p>
    </div>
  );
}

function HorizontalBar({
  title,
  subtitle,
  data,
  tooltipSuffix,
}: {
  title: string;
  subtitle: string;
  data: BarEntry[];
  tooltipSuffix: string;
}) {
  const barHeight = 32;
  const chartHeight = Math.max(200, data.length * barHeight + 40);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
      <h2 className="text-base font-semibold text-stone-800 mb-1">{title}</h2>
      <p className="text-xs text-stone-400 mb-4">{subtitle}</p>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
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
            width={110}
            tick={{ fontSize: 11, fill: "#44403c" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={
              <CustomTooltip suffix={tooltipSuffix} />
            }
            cursor={{ fill: "#f5f5f4" }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.85} />
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

export default function Price100mlChart({ rows }: Props) {
  const latest = latestMonthRows(rows);

  // --- By brand ---
  const brandMap = new Map<string, number[]>();
  for (const r of latest) {
    if (!brandMap.has(r.brand)) brandMap.set(r.brand, []);
    brandMap.get(r.brand)!.push(r.avg_price_per_100ml);
  }
  const brandData: BarEntry[] = Array.from(brandMap.entries())
    .map(([name, vals], i) => ({
      name,
      value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
    .sort((a, b) => a.value - b.value); // cheapest first

  // --- By shop ---
  const shopMap = new Map<string, number[]>();
  for (const r of latest) {
    if (!shopMap.has(r.shop_name)) shopMap.set(r.shop_name, []);
    shopMap.get(r.shop_name)!.push(r.avg_price_per_100ml);
  }
  const shopData: BarEntry[] = Array.from(shopMap.entries())
    .map(([name, vals], i) => ({
      name,
      value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }))
    .sort((a, b) => a.value - b.value); // cheapest first

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <HorizontalBar
          title="Best Value — by Brand"
          subtitle="Avg €/100ml across all products · latest month · cheapest first"
          data={brandData}
          tooltipSuffix="avg across all sizes & shops"
        />
        <HorizontalBar
          title="Best Value — by Shop"
          subtitle="Avg €/100ml across all products · latest month · cheapest first"
          data={shopData}
          tooltipSuffix="avg across all products stocked"
        />
      </div>
    </div>
  );
}
