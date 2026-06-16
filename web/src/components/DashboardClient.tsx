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

type Props = {
  rows: PriceRow[];
  byBrand: BrandRow[];
  byShop: ShopRow[];
  lastUpdated: string;
};

function FilterDropdown<T extends string | number>({
  label, items, selected, onChange, format, allLabel,
}: {
  label: string;
  items: T[];
  selected: string;
  onChange: (v: string) => void;
  format: (v: T) => string;
  allLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-widest">{label}</span>
        {selected && (
          <button onClick={() => onChange("")} className="text-xs text-amber-600 hover:text-amber-800 font-medium">
            Clear
          </button>
        )}
      </div>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
      >
        <option value="">{allLabel}</option>
        {items.map((v) => (
          <option key={String(v)} value={String(v)}>{format(v)}</option>
        ))}
      </select>
    </div>
  );
}

export default function DashboardClient({ rows, byBrand, byShop, lastUpdated }: Props) {
  const allBrands   = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).sort(), [rows]);
  const allSizes    = useMemo(() => Array.from(new Set(rows.map((r) => r.volume_ml))).sort((a, b) => a - b), [rows]);
  const allShops    = useMemo(() => Array.from(new Set(rows.map((r) => r.shop_name))).sort(), [rows]);
  const allProducts = useMemo(() => Array.from(new Set(rows.map((r) => r.product_name))).sort(), [rows]);

  const [selectedBrand,   setSelectedBrand]   = useState<string>("");
  const [selectedSize,    setSelectedSize]    = useState<string>("");
  const [selectedShop,    setSelectedShop]    = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");

  const filtered = useMemo(
    () => rows.filter((r) =>
      (selectedBrand === "" || r.brand === selectedBrand) &&
      (selectedSize === "" || r.volume_ml === Number(selectedSize)) &&
      (selectedShop === "" || r.shop_name === selectedShop) &&
      (selectedProduct === "" || r.product_name === selectedProduct)
    ),
    [rows, selectedBrand, selectedSize, selectedShop, selectedProduct]
  );

  const stats    = scorecards(filtered);
  const trend    = pivotForTrend(filtered);
  const latest   = latestMonthRows(filtered);
  const products = productNames(filtered);

  return (
    <div className="space-y-8">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-5 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <FilterDropdown
            label="Brand" items={allBrands} selected={selectedBrand}
            onChange={setSelectedBrand} format={(v) => v} allLabel="All brands"
          />
          <FilterDropdown
            label="Size" items={allSizes} selected={selectedSize}
            onChange={setSelectedSize} format={formatSize} allLabel="All sizes"
          />
          <FilterDropdown
            label="Shop" items={allShops} selected={selectedShop}
            onChange={setSelectedShop} format={(v) => v} allLabel="All shops"
          />
          <FilterDropdown
            label="Product" items={allProducts} selected={selectedProduct}
            onChange={setSelectedProduct} format={(v) => v} allLabel="All products"
          />
        </div>
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

      {/* Best Value charts — directly under KPIs */}
      <Price100mlChart byBrand={byBrand} byShop={byShop} />

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
