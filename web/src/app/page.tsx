import fs from "fs";
import path from "path";
import Link from "next/link";
import type { PriceRow } from "@/app/api/prices/route";
import { scorecards } from "@/lib/transforms";
import DashboardClient from "@/components/DashboardClient";

export const revalidate = 3600;

function DbtSummaryCard() {
  try {
    const p = path.join(process.cwd(), "public/dbt-docs/summary.json");
    const s = JSON.parse(fs.readFileSync(p, "utf-8"));
    const allPass = s.failed === 0 && s.warned === 0;
    return (
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-3xl">{allPass ? "✅" : "❌"}</span>
          <div>
            <h3 className="font-semibold text-stone-800 text-sm">dbt Data Quality</h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {s.passed}/{s.total} tests passing · {s.models} models · 4 layers (raw → staging → dwh → datamart)
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link
            href="/dbt"
            className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-lg px-3 py-1.5 font-medium hover:bg-orange-100 transition-colors"
          >
            Test Results →
          </Link>
          <a
            href="https://atsushisakai-a11y.github.io/soy-sauce-tracker/#!/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-stone-900 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-stone-700 transition-colors"
          >
            Lineage DAG ↗
          </a>
        </div>
      </div>
    );
  } catch {
    return null;
  }
}

async function fetchPrices(): Promise<PriceRow[]> {
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
      global_product_id,
      shop_name,
      COALESCE(product_url, '')            AS product_url,
      FORMAT_DATE('%Y-%m', scrape_month)   AS scrape_month,
      brand,
      product_name,
      CAST(volume_ml  AS INT64)            AS volume_ml,
      CAST(shop_count AS INT64)            AS shop_count,
      ROUND(min_price_eur, 2)              AS min_price_eur,
      ROUND(max_price_eur, 2)              AS max_price_eur,
      ROUND(avg_price_eur, 2)              AS avg_price_eur
    FROM \`soy-sauce-tracker.datamart.datamart_price_comparison\`
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

  const stats = scorecards(rows);

  return (
    <main className="min-h-screen bg-stone-50">

      {/* Hero banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-stone-900 via-amber-950 to-stone-900 min-h-[160px] flex items-center">
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center gap-8">
          {/* Bottle + title */}
          <div className="flex items-center gap-5 flex-shrink-0">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold px-3 py-1 rounded-full mb-3 tracking-wide uppercase">
                🌍 Europe · {stats.lastUpdated} data
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
                European<br />
                <span className="text-amber-400">Soy Sauce</span><br />
                Price Tracker
              </h1>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px self-stretch bg-white/10" />

          {/* Tagline + stats */}
          <div className="flex-1 text-center sm:text-left">
            <p className="text-stone-300 text-base leading-relaxed mb-5">
              Compare soy sauce prices across European online shops — so you always know where to find the best bottle at the best price.
            </p>
            <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
              <span className="flex items-center gap-1.5 text-xs text-stone-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
                Monthly price scraping
              </span>
              <span className="flex items-center gap-1.5 text-xs text-stone-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"></span>
                14 brands tracked
              </span>
              <span className="flex items-center gap-1.5 text-xs text-stone-400">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"></span>
                {stats.shops}+ shops compared
              </span>
            </div>
          </div>
        </div>
      </div>

<div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            <strong>Data error:</strong> {error}
          </div>
        )}

        {/* Brand filter + all charts/table (client component) */}
        <DashboardClient rows={rows} lastUpdated={stats.lastUpdated} />

        {/* dbt quality card */}
        <DbtSummaryCard />

        {/* Footer */}
        <footer className="text-center text-xs text-stone-300 py-4">
          Data scraped from public shop pages · prices in EUR · not affiliated with any brand
        </footer>
      </div>
    </main>
  );
}
