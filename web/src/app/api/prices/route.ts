import { BigQuery } from "@google-cloud/bigquery";
import { NextResponse } from "next/server";

export const revalidate = 3600; // cache 1 hour

export type PriceRow = {
  global_product_id: string;
  shop_name: string;
  product_url: string;
  scrape_month: string;      // "YYYY-MM"
  brand: string;
  product_name: string;
  volume_ml: number;
  shop_count: number;
  min_price_eur: number;
  max_price_eur: number;
  avg_price_eur: number;
  avg_price_per_100ml: number;
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
        global_product_id,
        shop_name,
        COALESCE(product_url, '')            AS product_url,
        FORMAT_DATE('%Y-%m', scrape_month)   AS scrape_month,
        brand,
        product_name,
        CAST(volume_ml    AS INT64)          AS volume_ml,
        CAST(shop_count   AS INT64)          AS shop_count,
        ROUND(min_price_eur, 2)              AS min_price_eur,
        ROUND(max_price_eur, 2)              AS max_price_eur,
        ROUND(avg_price_eur, 2)              AS avg_price_eur,
        ROUND(avg_price_per_100ml, 2)        AS avg_price_per_100ml
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
