import { BigQuery } from "@google-cloud/bigquery";

export const revalidate = 3600;

type ShopStats = {
  shop_name: string;
  product_count: number;
  avg_price: number;
  cheapest_price: number;
  most_expensive: number;
};

type ShopMeta = {
  flag: string;
  url: string;
  tagline: string;
  strengths: string[];
  bestFor: string;
  verdict: string;
  priceTag: "💚 Cheapest" | "💛 Mid-range" | "🔴 Premium";
  selectionScore: number;   // 1–5
  reliabilityScore: number; // 1–5
  overallScore: number;     // 1–5
};

const SHOP_META: Record<string, ShopMeta> = {
  "Dun Yong": {
    flag: "🇳🇱",
    url: "https://dunyong.com",
    tagline: "Amsterdam's largest Asian supermarket since 1969. Exceptional range, fair prices, reliable stock.",
    strengths: ["Established since 1969", "Widest brand + size range", "Physical stores in Amsterdam", "Online delivery across NL", "Free shipping from €55"],
    bestFor: "Shoppers who want the broadest selection of authentic Asian soy sauces in one place",
    verdict: "The go-to for serious soy sauce shoppers. Stocks Kikkoman, Yamasa, Lee Kum Kee, Pearl River Bridge, Sempio, Marukin, Takesan/Kishibori and many more. Prices are fair, stock is reliable, and the physical stores let you browse in person.",
    priceTag: "💛 Mid-range",
    selectionScore: 5,
    reliabilityScore: 5,
    overallScore: 5,
  },
  "Tjin's Toko": {
    flag: "🇳🇱",
    url: "https://www.tjinstoko.eu/en/search-per-category/condiments/soy-sauce/",
    tagline: "Rotterdam's oldest Asian grocery — one of the largest soy sauce selections in Europe.",
    strengths: ["Largest soy sauce range tracked", "10+ brands in stock", "Competitive pricing", "Physical + online", "English site available"],
    bestFor: "Anyone wanting the widest brand and size choice in one shop",
    verdict: "The most comprehensive soy sauce shop we track — stocking Kikkoman, Yamasa, Lee Kum Kee, Pearl River Bridge, Sempio, Mee Chun, Healthy Boy, Silver Swan, Dek Som Boon and more. Competitive prices across the board.",
    priceTag: "💛 Mid-range",
    selectionScore: 5,
    reliabilityScore: 5,
    overallScore: 5,
  },
  "ACE Market": {
    flag: "🇳🇱",
    url: "https://acemarket.nl",
    tagline: "Focused online Asian supermarket with a sharp soy sauce category.",
    strengths: ["Competitive prices", "Good brand variety", "Online convenience", "Regular updates"],
    bestFor: "Online shoppers looking for good value",
    verdict: "Strong online option with competitive prices. Good selection across Japanese, Chinese and Southeast Asian brands.",
    priceTag: "💚 Cheapest",
    selectionScore: 4,
    reliabilityScore: 4,
    overallScore: 4,
  },
  "Shilla Market": {
    flag: "🇳🇱",
    url: "https://shillamarket.com",
    tagline: "Korean-focused online shop. Best for Japanese specialty soy sauces.",
    strengths: ["Kikkoman specialty range", "Authentic Japanese varieties", "Fast NL delivery", "Tokusen & premium lines"],
    bestFor: "Japanese soy sauce enthusiasts",
    verdict: "The go-to for premium Kikkoman lines (Tokusen, Marudaizu). Prices are slightly higher but you get products other shops don't stock.",
    priceTag: "🔴 Premium",
    selectionScore: 3,
    reliabilityScore: 5,
    overallScore: 4,
  },
  "Amazing Oriental": {
    flag: "🇳🇱",
    url: "https://amazingoriental.com",
    tagline: "Pan-Netherlands Asian supermarket chain with consistent stock.",
    strengths: ["Multiple locations", "Consistent stock", "Good Chinese brands", "Everyday pricing"],
    bestFor: "Shoppers near an Amazing Oriental store",
    verdict: "Reliable everyday option. Good for mainstream Chinese and Southeast Asian soy sauces at sensible prices.",
    priceTag: "💛 Mid-range",
    selectionScore: 3,
    reliabilityScore: 4,
    overallScore: 3,
  },
  "Oriental Webshop": {
    flag: "🇳🇱",
    url: "https://www.orientalwebshop.nl",
    tagline: "Dutch online Asian grocery with broad Asian cuisine coverage.",
    strengths: ["Online convenience", "Broad range", "Good for hard-to-find items"],
    bestFor: "Online shoppers wanting a broad range",
    verdict: "Decent online option with a wide range. Good for discovering less common brands.",
    priceTag: "💛 Mid-range",
    selectionScore: 3,
    reliabilityScore: 3,
    overallScore: 3,
  },
  "Wah Nam Hong": {
    flag: "🇳🇱",
    url: "https://www.wah-nam-hong.nl",
    tagline: "Wholesale-oriented importer with competitive bulk pricing.",
    strengths: ["Wholesale prices", "Chinese brand specialist", "Value for money"],
    bestFor: "Bulk buyers and Chinese brand fans",
    verdict: "Best for Pearl River Bridge and other Chinese brands at wholesale-adjacent prices.",
    priceTag: "💚 Cheapest",
    selectionScore: 3,
    reliabilityScore: 3,
    overallScore: 3,
  },
  "Albert Heijn": {
    flag: "🇳🇱",
    url: "https://www.ah.nl",
    tagline: "Most accessible — every neighbourhood has one. Limited but reliable range.",
    strengths: ["Everywhere in NL", "Convenient", "Kikkoman always in stock", "Bonus card deals"],
    bestFor: "Last-minute purchases or non-specialist shoppers",
    verdict: "Convenient but limited to mainstream brands and sizes. Prices are slightly higher than Asian specialists. Fine for Kikkoman basics.",
    priceTag: "🔴 Premium",
    selectionScore: 2,
    reliabilityScore: 5,
    overallScore: 3,
  },
  "Jumbo": {
    flag: "🇳🇱",
    url: "https://www.jumbo.com",
    tagline: "Dutch supermarket chain. Basic soy sauce range, convenient locations.",
    strengths: ["Convenient", "Reliable stock of basics", "Competitive own-brand pricing"],
    bestFor: "Quick top-up purchases",
    verdict: "Very limited selection — mainly Kikkoman 250ml. Fine if you just need something quickly.",
    priceTag: "🔴 Premium",
    selectionScore: 1,
    reliabilityScore: 4,
    overallScore: 2,
  },
  "NikanKitchen": {
    flag: "🇩🇪",
    url: "https://www.nikankitchen.com",
    tagline: "Germany-based Japanese food specialist delivering across Europe.",
    strengths: ["Premium Japanese range", "Ships EU-wide", "Specialty and artisan products"],
    bestFor: "Japanese food enthusiasts outside NL",
    verdict: "Great for premium and hard-to-find Japanese soy sauces. Slightly higher prices due to international shipping.",
    priceTag: "🔴 Premium",
    selectionScore: 4,
    reliabilityScore: 4,
    overallScore: 3,
  },
};

function Stars({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i < score ? "text-amber-400" : "text-stone-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

async function fetchShopStats(): Promise<ShopStats[]> {
  try {
    const { BigQuery } = await import("@google-cloud/bigquery");
    let bq: InstanceType<typeof BigQuery>;
    const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credJson) {
      bq = new BigQuery({ projectId: "soy-sauce-tracker", credentials: JSON.parse(credJson) });
    } else {
      bq = new BigQuery({ projectId: "soy-sauce-tracker" });
    }
    const [rows] = await bq.query(`
      WITH latest AS (
        SELECT MAX(scrape_month) AS m FROM \`soy-sauce-tracker.datamart.datamart_price_comparison\`
      )
      SELECT
        d.shop_name,
        COUNT(DISTINCT d.global_product_id)   AS product_count,
        ROUND(AVG(d.avg_price_eur), 2)        AS avg_price,
        ROUND(MIN(d.min_price_eur), 2)        AS cheapest_price,
        ROUND(MAX(d.max_price_eur), 2)        AS most_expensive
      FROM \`soy-sauce-tracker.datamart.datamart_price_comparison\` d, latest
      WHERE d.scrape_month = latest.m
      GROUP BY d.shop_name
      ORDER BY avg_price ASC
    `);
    return rows as ShopStats[];
  } catch {
    return [];
  }
}

export default async function ShopsPage() {
  const stats = await fetchShopStats();

  // Merge live stats with qualitative meta
  const shops = stats
    .map((s) => ({ ...s, meta: SHOP_META[s.shop_name] }))
    .filter((s) => s.meta);

  const fmt = (n: number) =>
    n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-stone-900 mb-1">Which shop should I buy from?</h1>
          <p className="text-sm text-stone-400">Shops ranked by average price · latest month's data · with selection and reliability ratings.</p>
        </div>

        {/* Top pick callout */}
        {shops.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4 items-start">
            <span className="text-3xl">🏆</span>
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-0.5">Best overall pick</p>
              <p className="text-base font-bold text-amber-800">
                {shops.sort((a, b) => b.meta.overallScore - a.meta.overallScore)[0].shop_name}
              </p>
              <p className="text-sm text-amber-700 mt-1">
                {shops.sort((a, b) => b.meta.overallScore - a.meta.overallScore)[0].meta.verdict}
              </p>
            </div>
          </div>
        )}

        {/* Shop cards ranked by avg price */}
        <div className="space-y-4">
          {[...shops].sort((a, b) => a.avg_price - b.avg_price).map((shop, rank) => (
            <a
              key={shop.shop_name}
              href={shop.meta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white rounded-2xl border border-stone-100 shadow-sm p-5 hover:border-amber-300 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-4">
                {/* Rank badge */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  rank === 0 ? "bg-amber-400 text-white" :
                  rank === 1 ? "bg-stone-200 text-stone-600" :
                  rank === 2 ? "bg-orange-200 text-orange-700" :
                  "bg-stone-100 text-stone-400"
                }`}>
                  {rank + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-base font-bold text-stone-900 group-hover:text-amber-700 transition-colors">
                      {shop.shop_name}
                    </span>
                    <span>{shop.meta.flag}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                      shop.meta.priceTag.includes("Cheapest") ? "bg-green-50 text-green-700 border-green-200" :
                      shop.meta.priceTag.includes("Mid")      ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                                 "bg-red-50 text-red-600 border-red-200"
                    }`}>
                      {shop.meta.priceTag}
                    </span>
                  </div>

                  <p className="text-xs text-stone-500 mb-3">{shop.meta.tagline}</p>

                  {/* Verdict */}
                  <p className="text-sm text-stone-600 leading-relaxed mb-3">{shop.meta.verdict}</p>

                  {/* Strengths */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {shop.meta.strengths.map((s) => (
                      <span key={s} className="text-xs bg-stone-50 border border-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                        ✓ {s}
                      </span>
                    ))}
                  </div>

                  {/* Scores + live data */}
                  <div className="flex flex-wrap items-center gap-6 text-xs text-stone-500">
                    <div>
                      <span className="text-stone-400 mr-1">Selection</span>
                      <Stars score={shop.meta.selectionScore} />
                    </div>
                    <div>
                      <span className="text-stone-400 mr-1">Reliability</span>
                      <Stars score={shop.meta.reliabilityScore} />
                    </div>
                    <div>
                      <span className="text-stone-400 mr-1">Overall</span>
                      <Stars score={shop.meta.overallScore} />
                    </div>
                  </div>
                </div>

                {/* Live price stats */}
                {stats.length > 0 && (
                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <div className="text-lg font-bold text-stone-800">{fmt(shop.avg_price)}</div>
                    <div className="text-xs text-stone-400">avg price</div>
                    <div className="text-xs text-stone-400 mt-1">
                      {fmt(shop.cheapest_price)} – {fmt(shop.most_expensive)}
                    </div>
                    <div className="text-xs text-stone-300 mt-1">{shop.product_count} products</div>
                  </div>
                )}
              </div>

              {/* Best for */}
              <div className="mt-3 pt-3 border-t border-stone-50 flex items-center gap-2">
                <span className="text-xs text-stone-400">Best for:</span>
                <span className="text-xs font-medium text-stone-600">{shop.meta.bestFor}</span>
                <svg className="w-3 h-3 text-stone-300 group-hover:text-amber-400 ml-auto transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </a>
          ))}
        </div>

        <p className="text-xs text-stone-300 text-center">
          Prices from latest scrape · rankings combine avg price, selection breadth and stock reliability
        </p>
      </div>
    </main>
  );
}
