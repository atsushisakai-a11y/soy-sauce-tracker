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
import { latestMonthRows, CHART_COLORS } from "@/lib/transforms";

type ColorBy = "brand" | "shop";
type Props = { rows: PriceRow[]; colorBy?: ColorBy };

type Point = {
  x: number;
  y: number;
  name: string;
  brand: string;
  shop: string;
  min: number;
  max: number;
  shops: number;
};

function CustomTooltip({
  active,
  payload,
  colorBy,
}: {
  active?: boolean;
  payload?: Array<{ payload: Point }>;
  colorBy: ColorBy;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const fmt = (n: number) =>
    n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  const size = d.x >= 1000 ? `${d.x / 1000}L` : `${d.x}ml`;
  const subtitle = colorBy === "shop"
    ? `${d.shop} · ${size}`
    : `${d.brand} · ${size}`;
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-lg p-3 text-xs max-w-[220px]">
      <p className="font-semibold text-stone-800 mb-1 leading-snug">{d.name}</p>
      <p className="text-stone-400 mb-2">{subtitle}</p>
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
        {colorBy === "brand" && (
          <div className="flex justify-between gap-4">
            <span className="text-stone-400">Shops</span>
            <span className="text-stone-600">{d.shops}</span>
          </div>
        )}
        {colorBy === "shop" && (
          <div className="flex justify-between gap-4">
            <span className="text-stone-400">Shop</span>
            <span className="text-stone-600">{d.shop}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PriceScatterChart({ rows, colorBy = "brand" }: Props) {
  const latest = latestMonthRows(rows);

  const keys = Array.from(new Set(latest.map((r) =>
    colorBy === "shop" ? r.shop_name : r.brand
  ))).sort();

  const colorMap = Object.fromEntries(
    keys.map((k, i) => [k, CHART_COLORS[i % CHART_COLORS.length]])
  );

  const points: Point[] = latest.map((r) => ({
    x: r.volume_ml,
    y: r.avg_price_eur,
    name: r.product_name,
    brand: r.brand,
    shop: r.shop_name,
    min: r.min_price_eur,
    max: r.max_price_eur,
    shops: r.shop_count,
  }));

  const xTicks = Array.from(new Set(points.map((p) => p.x))).sort((a, b) => a - b);
  const fmtSize = (ml: number) => ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`;

  const title = colorBy === "shop"
    ? "Price vs Size — by Shop"
    : "Price vs Size — by Brand";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
      <h2 className="text-base font-semibold text-stone-800 mb-1">{title}</h2>
      <p className="text-xs text-stone-400 mb-4">
        Avg price (EUR) · latest month · hover for details
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {keys.map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-stone-500">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: colorMap[k] }}
            />
            {k}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
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
          <Tooltip content={<CustomTooltip colorBy={colorBy} />} cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={points} isAnimationActive={false}>
            {points.map((p, i) => {
              const key = colorBy === "shop" ? p.shop : p.brand;
              return (
                <Cell
                  key={i}
                  fill={colorMap[key]}
                  fillOpacity={0.85}
                  stroke={colorMap[key]}
                  strokeWidth={1}
                  r={6}
                />
              );
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
