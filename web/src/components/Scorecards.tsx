"use client";

type Props = {
  avgPrice: number;
  cheapest: number;
  mostExpensive: number;
  products: number;
  shops: number;
  lastUpdated: string;
};

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold text-stone-900">{value}</p>
      {sub && <p className="text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

export default function Scorecards(props: Props) {
  const fmt = (n: number) =>
    n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <Card label="Avg Market Price" value={fmt(props.avgPrice)} sub="latest month" />
      <Card label="Cheapest Available" value={fmt(props.cheapest)} sub="any shop" />
      <Card label="Most Expensive" value={fmt(props.mostExpensive)} sub="any shop" />
      <Card label="Products Tracked" value={String(props.products)} sub="unique products" />
      <Card label="Last Updated" value={props.lastUpdated} sub="scrape month" />
    </div>
  );
}
