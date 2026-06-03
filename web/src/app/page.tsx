import type { PriceRow } from "@/app/api/prices/route";
import {
  pivotForTrend,
  latestMonthRows,
  productNames,
  scorecards,
} from "@/lib/transforms";
import Scorecards from "@/components/Scorecards";
import PriceTrendChart from "@/components/PriceTrendChart";
import PriceRangeChart from "@/components/PriceRangeChart";
import PriceTable from "@/components/PriceTable";

export const revalidate = 3600;

async function fetchPrices(): Promise<PriceRow[]> {
  // In production (Vercel) the API route runs on the same host.
  // We call BigQuery directly here so we avoid an HTTP round-trip during SSR.
  const { BigQuery } = await import("@google-cloud/bigquery");

  let bq: InstanceType<typeof BigQuery>;
  const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credJson) {
    const credentials = JSON.parse(credJson);
    bq = new BigQuery({ projectId: "soy-sauce-tracker", credentials });
  } else {
    bq = new BigQuery({ projectId: "soy-sauce-tracker" });
  }

  const [rows] = await bq.query(`
    SELECT
      brand,
      global_product_id,
      FORMAT_DATE('%Y-%m', scrape_month)   AS scrape_month,
      product_name,
      CAST(shop_count AS INT64)            AS shop_count,
      ROUND(min_price_eur, 2)              AS min_price_eur,
      ROUND(max_price_eur, 2)              AS max_price_eur,
      ROUND(avg_price_eur, 2)              AS avg_price_eur
    FROM \`soy-sauce-tracker.staging.datamart_price_comparison\`
    ORDER BY scrape_month ASC, avg_price_eur DESC
  `);

  return rows as PriceRow[];
}

export default async function Home() {
  let rows: PriceRow[] = [];
  let error: string | null = null;

  try {
    rows = await fetchPrices();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  const stats   = scorecards(rows);
  const trend   = pivotForTrend(rows);
  const latest  = latestMonthRows(rows);
  const products = productNames(rows);

  return (
    <main className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🫙</span>
            <div>
              <h1 className="text-xl font-bold text-stone-900 leading-tight">
                European Soy Sauce Price Tracker
              </h1>
              <p className="text-xs text-stone-400">
                Real prices scraped from European online shops · updated monthly
              </p>
            </div>
          </div>
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1 font-medium">
            Last scrape: {stats.lastUpdated}
          </span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            <strong>Data error:</strong> {error}
          </div>
        )}

        {/* Scorecards */}
        <Scorecards
          avgPrice={stats.avgPrice}
          cheapest={stats.cheapest}
          mostExpensive={stats.mostExpensive}
          products={stats.products}
          shops={stats.shops}
          lastUpdated={stats.lastUpdated}
        />

        {/* Charts row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <PriceTrendChart data={trend} products={products} />
          <PriceRangeChart rows={latest} />
        </div>

        {/* Full table */}
        <PriceTable rows={rows} />

        {/* Footer */}
        <footer className="text-center text-xs text-stone-300 py-4">
          Data scraped from public shop pages · prices in EUR · not affiliated with any brand
        </footer>
      </div>
    </main>
  );
}
