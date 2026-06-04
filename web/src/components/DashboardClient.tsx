"use client";

import { useState, useMemo } from "react";
import type { PriceRow } from "@/app/api/prices/route";
import { pivotForTrend, latestMonthRows, productNames } from "@/lib/transforms";
import Scorecards from "@/components/Scorecards";
import PriceTrendChart from "@/components/PriceTrendChart";
import PriceRangeChart from "@/components/PriceRangeChart";
import PriceTable from "@/components/PriceTable";
import { scorecards } from "@/lib/transforms";

type Props = {
  rows: PriceRow[];
  lastUpdated: string;
};

export default function DashboardClient({ rows, lastUpdated }: Props) {
  // Collect unique brands sorted alphabetically
  const allBrands = useMemo(
    () => [...new Set(rows.map((r) => r.brand))].sort(),
    [rows]
  );

  const [selected, setSelected] = useState<Set<string>>(new Set(allBrands));

  const toggle = (brand: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(brand) ? next.delete(brand) : next.add(brand);
      return next;
    });

  const selectAll = () => setSelected(new Set(allBrands));
  const clearAll  = () => setSelected(new Set());

  const filtered = useMemo(
    () => rows.filter((r) => selected.has(r.brand)),
    [rows, selected]
  );

  const stats    = scorecards(filtered);
  const trend    = pivotForTrend(filtered);
  const latest   = latestMonthRows(filtered);
  const products = productNames(filtered);

  return (
    <div className="space-y-8">
      {/* Brand filter bar */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
            Filter by Brand
          </span>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-amber-600 hover:text-amber-800 font-medium"
            >
              All
            </button>
            <span className="text-stone-200">|</span>
            <button
              onClick={clearAll}
              className="text-xs text-stone-400 hover:text-stone-600 font-medium"
            >
              None
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {allBrands.map((brand) => {
            const active = selected.has(brand);
            return (
              <button
                key={brand}
                onClick={() => toggle(brand)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-stone-400 border-stone-200 hover:border-amber-300 hover:text-amber-600"
                }`}
              >
                {brand}
              </button>
            );
          })}
        </div>
        {selected.size === 0 && (
          <p className="text-xs text-stone-400 mt-2">
            No brands selected — select at least one to see data.
          </p>
        )}
      </div>

      {/* Scorecards */}
      <Scorecards
        avgPrice={stats.avgPrice}
        cheapest={stats.cheapest}
        mostExpensive={stats.mostExpensive}
        products={stats.products}
        shops={stats.shops}
        lastUpdated={lastUpdated}
      />

      {/* Charts */}
      {filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <PriceTrendChart data={trend} products={products} />
            <PriceRangeChart rows={latest} />
          </div>
          <PriceTable rows={filtered} />
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-12 text-center text-stone-400 text-sm">
          Select a brand above to see data.
        </div>
      )}
    </div>
  );
}
