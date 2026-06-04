"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { shortName, CHART_COLORS } from "@/lib/transforms";

const MAX_PRODUCTS = 10;

type Props = {
  data: Array<Record<string, string | number>>;
  products: string[]; // already sorted by latest avg price desc
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
      <p className="font-semibold text-stone-600 mb-2 text-xs">{label}</p>
      {[...payload]
        .sort((a, b) => b.value - a.value)
        .map((p) => (
          <div key={p.name} className="flex justify-between gap-4 text-xs py-0.5">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              <span className="text-stone-600 truncate max-w-[150px]">{shortName(p.name)}</span>
            </span>
            <span className="font-medium text-stone-800 whitespace-nowrap">
              {p.value.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
            </span>
          </div>
        ))}
    </div>
  );
}

export default function PriceTrendChart({ data, products }: Props) {
  const shown = products.slice(0, MAX_PRODUCTS);
  const hidden = products.length - MAX_PRODUCTS;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
      <div className="flex items-start justify-between mb-1 gap-2">
        <div>
          <h2 className="text-base font-semibold text-stone-800">Average Price Trend</h2>
          <p className="text-xs text-stone-400 mt-0.5">Monthly avg price (EUR) · top {MAX_PRODUCTS} by price</p>
        </div>
        {hidden > 0 && (
          <span className="text-xs bg-stone-100 text-stone-400 rounded-full px-2 py-1 whitespace-nowrap flex-shrink-0">
            +{hidden} more
          </span>
        )}
      </div>

      {/* Compact legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4 mt-2">
        {shown.map((name, i) => (
          <span key={name} className="flex items-center gap-1 text-xs text-stone-500">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            {shortName(name)}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
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
          {shown.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
