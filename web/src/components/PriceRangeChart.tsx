"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PriceRow } from "@/app/api/prices/route";
import { shortName } from "@/lib/transforms";

type Props = { rows: PriceRow[] };

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-lg p-3 text-sm min-w-[180px]">
      <p className="font-semibold text-stone-700 mb-2 text-xs leading-tight">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-3 text-xs py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.fill }} />
            <span className="text-stone-500 capitalize">{p.name}</span>
          </span>
          <span className="font-medium text-stone-800">
            {p.value.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PriceRangeChart({ rows }: Props) {
  const data = rows.map((r) => ({
    name: shortName(r.product_name),
    min: r.min_price_eur,
    avg: r.avg_price_eur,
    max: r.max_price_eur,
  }));

  // Each bar group needs ~60px width to be readable
  const chartWidth = Math.max(700, data.length * 60);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
      <h2 className="text-base font-semibold text-stone-800 mb-1">
        Price Range — Latest Month
      </h2>
      <p className="text-xs text-stone-400 mb-4">
        Min / Avg / Max price (EUR) · scroll to see all · hover for details
      </p>

      {/* Horizontally scrollable container */}
      <div className="overflow-x-auto pb-2">
        <div style={{ width: chartWidth, height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 4, right: 16, left: 0, bottom: 80 }}
              barCategoryGap="35%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#78716c" }}
                tickLine={false}
                axisLine={{ stroke: "#e7e5e4" }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tickFormatter={(v) => `€${v}`}
                tick={{ fontSize: 11, fill: "#78716c" }}
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                iconType="square"
                iconSize={10}
                formatter={(v) => (
                  <span className="text-xs text-stone-600 capitalize">{v}</span>
                )}
              />
              <Bar dataKey="min" name="min" fill="#fde68a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="avg" name="avg" fill="#d97706" radius={[3, 3, 0, 0]} />
              <Bar dataKey="max" name="max" fill="#92400e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
