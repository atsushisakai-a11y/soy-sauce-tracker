import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";

export const revalidate = 3600; // cache 1 hour

export type PriceRow = {
  brand: string;
  global_product_id: string;
  scrape_month: string;      // "YYYY-MM"
  product_name: string;
  shop_count: number;
  min_price_eur: number;
  max_price_eur: number;
  avg_price_eur: number;
};

function getClient(): BigQuery {
  const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credJson) {
    const credentials = JSON.parse(credJson);
    return new BigQuery({ projectId: "soy-sauce-tracker", credentials });
  }
  // Local dev: relies on GOOGLE_APPLICATION_CREDENTIALS env var or gcloud ADC
  return new BigQuery({ projectId: "soy-sauce-tracker" });
}

export async function GET() {
  try {
    const bq = getClient();
    const [rows] = await bq.query(`
      SELECT
        brand,
        global_product_id,
        FORMAT_DATE('%Y-%m', scrape_month)   AS scrape_month,
        product_name,
        CAST(shop_count      AS INT64)       AS shop_count,
        ROUND(min_price_eur, 2)              AS min_price_eur,
        ROUND(max_price_eur, 2)              AS max_price_eur,
        ROUND(avg_price_eur, 2)              AS avg_price_eur
      FROM \`soy-sauce-tracker.datamart.datamart_price_comparison\`
      ORDER BY scrape_month ASC, avg_price_eur DESC
    `);

    return NextResponse.json(rows as PriceRow[], {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    console.error("BigQuery error:", err);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
  }
}
