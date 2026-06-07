"use client";

import { useState, useMemo } from "react";
import type { PriceRow } from "@/app/api/prices/route";
import type { BrandRow, ShopRow } from "@/app/page";
import { pivotForTrend, latestMonthRows, productNames, scorecards, formatSize } from "@/lib/transforms";
import Scorecards from "@/components/Scorecards";
import PriceTrendChart from "@/components/PriceTrendChart";
import PriceRangeChart from "@/components/PriceRangeChart";
import PriceTable from "@/components/PriceTable";
import PriceScatterChart from "@/components/PriceScatterChart";
import Price100mlChart from "@/components/Price100mlChart";
import BrandDirectory from "@/components/BrandDirectory";
import ShopDirectory from "@/components/ShopDirectory";

type Props = {
  rows: PriceRow[];
  byBrand: BrandRow[];
  byShop: ShopRow[];
  lastUpdated: string;
};

function FilterBar<T extends string | number>({
  label, items, selected, onToggle, onAll, onNone, format,
}: {
  label: string;
  items: T[];
  selected: Set<T>;
  onToggle: (v: T) => void;
  onAll: () => void;
  onNone: () => void;
  format: (v: T) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-widest">{label}</span>
        <div className="flex gap-2">
          <button onClick={onAll}  className="text-xs text-amber-600 hover:text-amber-800 font-medium">All</button>
          <span className="text-stone-200">|</span>
          <button onClick={onNone} className="text-xs text-stone-400 hover:text-stone-600 font-medium">None</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((v) => {
          const active = selected.has(v);
          return (
            <button
              key={String(v)}
              onClick={() => onToggle(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-stone-400 border-stone-200 hover:border-amber-300 hover:text-amber-600"
              }`}
            >
              {format(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardClient({ rows, byBrand, byShop, lastUpdated }: Props) {
  const allBrands = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).sort(), [rows]);
  const allSizes  = useMemo(() => Array.from(new Set(rows.map((r) => r.volume_ml))).sort((a, b) => a - b), [rows]);
  const allShops  = useMemo(() => Array.from(new Set(rows.map((r) => r.shop_name))).sort(), [rows]);

  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set(allBrands));
  const [selectedSizes,  setSelectedSizes]  = useState<Set<number>>(new Set(allSizes));
  const [selectedShops,  setSelectedShops]  = useState<Set<string>>(new Set(allShops));

  const toggle = <T,>(set: Set<T>, val: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    setter(next);
  };

  const filtered = useMemo(
    () => rows.filter((r) =>
      selectedBrands.has(r.brand) &&
      selectedSizes.has(r.volume_ml) &&
      selectedShops.has(r.shop_name)
    ),
    [rows, selectedBrands, selectedSizes, selectedShops]
  );

  const activeBrands = useMemo(
    () => Array.from(new Set(filtered.map((r) => r.brand))).sort(),
    [filtered]
  );

  const stats    = scorecards(filtered);
  const trend    = pivotForTrend(filtered);
  const latest   = latestMonthRows(filtered);
  const products = productNames(filtered);

  return (
    <div className="space-y-8">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-5 py-4 space-y-4">
        <FilterBar
          label="Brand" items={allBrands} selected={selectedBrands}
          onToggle={(v) => toggle(selectedBrands, v, setSelectedBrands)}
          onAll={() => setSelectedBrands(new Set(allBrands))}
          onNone={() => setSelectedBrands(new Set())}
          format={(v) => v}
        />
        <div className="border-t border-stone-50 pt-4">
          <FilterBar
            label="Size" items={allSizes} selected={selectedSizes}
            onToggle={(v) => toggle(selectedSizes, v, setSelectedSizes)}
            onAll={() => setSelectedSizes(new Set(allSizes))}
            onNone={() => setSelectedSizes(new Set())}
            format={formatSize}
          />
        </div>
        <div className="border-t border-stone-50 pt-4">
          <FilterBar
            label="Shop" items={allShops} selected={selectedShops}
            onToggle={(v) => toggle(selectedShops, v, setSelectedShops)}
            onAll={() => setSelectedShops(new Set(allShops))}
            onNone={() => setSelectedShops(new Set())}
            format={(v) => v}
          />
        </div>
        {(selectedBrands.size === 0 || selectedSizes.size === 0 || selectedShops.size === 0) && (
          <p className="text-xs text-stone-400 pt-1">
            Select at least one brand, one size, and one shop to see data.
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

      {/* Charts + Directories + Table */}
      {filtered.length > 0 ? (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <PriceTrendChart data={trend} products={products} />
            <PriceRangeChart rows={latest} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <PriceScatterChart rows={filtered} colorBy="brand" />
            <PriceScatterChart rows={filtered} colorBy="shop" />
          </div>
          <Price100mlChart byBrand={byBrand} byShop={byShop} />
          <BrandDirectory activeBrands={activeBrands} />
          <ShopDirectory rows={filtered} />
          <PriceTable rows={filtered} />
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-12 text-center text-stone-400 text-sm">
          No data matches the selected filters.
        </div>
      )}
    </div>
  );
}
