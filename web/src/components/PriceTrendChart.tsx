"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { shortName, CHART_COLORS } from "@/lib/transforms";

type Props = {
  data: Array<Record<string, string | number>>;
  products: string[];
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-lg p-3 text-sm min-w-[200px]">
      <p className="font-semibold text-stone-700 mb-2">{label}</p>
      {payload
        .sort((a, b) => b.value - a.value)
        .map((p) => (
          <div key={p.name} className="flex justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: p.color }}
              />
              <span className="text-stone-600 truncate max-w-[130px]">{shortName(p.name)}</span>
            </span>
            <span className="font-medium text-stone-800">
              {p.value.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
            </span>
          </div>
        ))}
    </div>
  );
}

export default function PriceTrendChart({ data, products }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
      <h2 className="text-base font-semibold text-stone-800 mb-1">
        Average Price Trend
      </h2>
      <p className="text-xs text-stone-400 mb-5">Monthly average price (EUR) per product</p>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "#78716c" }}
            tickLine={false}
            axisLine={{ stroke: "#e7e5e4" }}
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
            formatter={(value) => (
              <span className="text-xs text-stone-600">{shortName(value)}</span>
            )}
            iconType="circle"
            iconSize={8}
          />
          {products.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
