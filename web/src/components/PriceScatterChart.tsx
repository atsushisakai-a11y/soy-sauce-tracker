"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { PriceRow } from "@/app/api/prices/route";
import { latestMonthRows } from "@/lib/transforms";
import { CHART_COLORS } from "@/lib/transforms";

type Props = { rows: PriceRow[] };

type Point = {
  x: number;       // volume_ml
  y: number;       // avg_price_eur
  name: string;
  brand: string;
  min: number;
  max: number;
  shops: number;
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const fmt = (n: number) =>
    n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  const size = d.x >= 1000 ? `${d.x / 1000}L` : `${d.x}ml`;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-lg p-3 text-xs max-w-[220px]">
      <p className="font-semibold text-stone-800 mb-1 leading-snug">{d.name}</p>
      <p className="text-stone-400 mb-2">{d.brand} · {size}</p>
      <div className="space-y-0.5">
        <div className="flex justify-between gap-4">
          <span className="text-stone-400">Avg</span>
          <span className="font-medium text-stone-700">{fmt(d.y)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-stone-400">Min</span>
          <span className="text-stone-600">{fmt(d.min)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-stone-400">Max</span>
          <span className="text-stone-600">{fmt(d.max)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-stone-400">Shops</span>
          <span className="text-stone-600">{d.shops}</span>
        </div>
      </div>
    </div>
  );
}

export default function PriceScatterChart({ rows }: Props) {
  const latest = latestMonthRows(rows);

  // Get unique brands for colour mapping
  const brands = Array.from(new Set(latest.map((r) => r.brand))).sort();
  const brandColor = Object.fromEntries(
    brands.map((b, i) => [b, CHART_COLORS[i % CHART_COLORS.length]])
  );

  const points: Point[] = latest.map((r) => ({
    x: r.volume_ml,
    y: r.avg_price_eur,
    name: r.product_name,
    brand: r.brand,
    min: r.min_price_eur,
    max: r.max_price_eur,
    shops: r.shop_count,
  }));

  // X-axis ticks: unique sizes, formatted
  const xTicks = Array.from(new Set(points.map((p) => p.x))).sort((a, b) => a - b);
  const fmtSize = (ml: number) => ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
      <h2 className="text-base font-semibold text-stone-800 mb-1">
        Price vs Size — Latest Month
      </h2>
      <p className="text-xs text-stone-400 mb-4">
        Avg price (EUR) by bottle size · hover for details
      </p>

      {/* Brand legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {brands.map((b) => (
          <span key={b} className="flex items-center gap-1.5 text-xs text-stone-500">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: brandColor[b] }}
            />
            {b}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" />
          <XAxis
            type="number"
            dataKey="x"
            name="Size"
            ticks={xTicks}
            tickFormatter={fmtSize}
            tick={{ fontSize: 11, fill: "#78716c" }}
            tickLine={false}
            axisLine={{ stroke: "#e7e5e4" }}
            label={{ value: "Bottle size", position: "insideBottom", offset: -4, fontSize: 11, fill: "#a8a29e" }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Avg price"
            tickFormatter={(v) => `€${v}`}
            tick={{ fontSize: 11, fill: "#78716c" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={points} isAnimationActive={false}>
            {points.map((p, i) => (
              <Cell
                key={i}
                fill={brandColor[p.brand]}
                fillOpacity={0.85}
                stroke={brandColor[p.brand]}
                strokeWidth={1}
                r={6}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
