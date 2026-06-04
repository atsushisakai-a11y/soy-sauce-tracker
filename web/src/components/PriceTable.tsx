"use client";

import { useState } from "react";
import type { PriceRow } from "@/app/api/prices/route";
import { formatSize } from "@/lib/transforms";

type Props = { rows: PriceRow[] };

function heatColor(value: number, min: number, max: number): string {
  if (max === min) return "bg-amber-100";
  const t = (value - min) / (max - min); // 0=cheapest, 1=most expensive
  if (t < 0.25) return "bg-green-100 text-green-900";
  if (t < 0.5)  return "bg-amber-100 text-amber-900";
  if (t < 0.75) return "bg-orange-100 text-orange-900";
  return "bg-red-100 text-red-900";
}

export default function PriceTable({ rows }: Props) {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<keyof PriceRow>("scrape_month");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const allAvg = rows.map((r) => r.avg_price_eur);
  const minAvg = Math.min(...allAvg);
  const maxAvg = Math.max(...allAvg);

  const filtered = rows
    .filter((r) =>
      r.product_name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });

  function toggleSort(col: keyof PriceRow) {
    if (col === sortCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  const Th = ({
    col,
    label,
    right,
  }: {
    col: keyof PriceRow;
    label: string;
    right?: boolean;
  }) => (
    <th
      className={`px-3 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wide cursor-pointer select-none hover:text-stone-800 ${right ? "text-right" : "text-left"}`}
      onClick={() => toggleSort(col)}
    >
      {label}
      {sortCol === col && (
        <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
      )}
    </th>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-800">Full Price History</h2>
          <p className="text-xs text-stone-400">All months · click column headers to sort</p>
        </div>
        <input
          type="search"
          placeholder="Filter products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-stone-100">
              <Th col="scrape_month" label="Month" />
              <Th col="brand" label="Brand" />
              <Th col="product_name" label="Product" />
              <Th col="volume_ml" label="Size" right />
              <Th col="shop_count" label="Shops" right />
              <Th col="min_price_eur" label="Min" right />
              <Th col="avg_price_eur" label="Avg" right />
              <Th col="max_price_eur" label="Max" right />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr
                key={`${r.global_product_id}-${r.scrape_month}`}
                className={`border-b border-stone-50 hover:bg-stone-50 transition-colors ${i % 2 === 0 ? "" : "bg-stone-50/40"}`}
              >
                <td className="px-3 py-2 font-mono text-xs text-stone-500">
                  {r.scrape_month}
                </td>
                <td className="px-3 py-2 text-xs text-stone-500">{r.brand}</td>
                <td className="px-3 py-2 text-stone-800 max-w-[200px] truncate" title={r.product_name}>
                  {r.product_name}
                </td>
                <td className="px-3 py-2 text-right text-stone-500 text-xs">{formatSize(r.volume_ml)}</td>
                <td className="px-3 py-2 text-right text-stone-600">{r.shop_count}</td>
                <td className="px-3 py-2 text-right text-stone-600">{fmt(r.min_price_eur)}</td>
                <td className={`px-3 py-2 text-right font-semibold rounded ${heatColor(r.avg_price_eur, minAvg, maxAvg)}`}>
                  {fmt(r.avg_price_eur)}
                </td>
                <td className="px-3 py-2 text-right text-stone-600">{fmt(r.max_price_eur)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-stone-400 text-sm">
                  No results for "{search}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-300 mt-3 text-right">{filtered.length} rows</p>
    </div>
  );
}
