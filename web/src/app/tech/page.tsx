import fs from "fs";
import path from "path";
import Link from "next/link";

const GITHUB_URL = "https://github.com/atsushisakai-a11y/soy-sauce-tracker";

// ── dbt Data Quality types & loader ──────────────────────────────────────────
type TestResult = {
  name: string;
  model: string;
  status: "pass" | "fail" | "warn";
  execution_time: number;
};
type DbtSummary = {
  generated_at: string;
  total: number;
  passed: number;
  failed: number;
  warned: number;
  models: number;
  tests: TestResult[];
};
function loadDbtSummary(): DbtSummary | null {
  try {
    const p = path.join(process.cwd(), "public/dbt-docs/summary.json");
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch { return null; }
}
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "UTC",
    }) + " UTC";
  } catch { return iso; }
}
const LAYER_ORDER = ["raw", "staging", "dwh", "datamart"];
function layerFromModel(model: string) {
  for (const l of LAYER_ORDER) if (model.startsWith(l)) return l;
  return "other";
}
const LAYER_COLORS: Record<string, string> = {
  raw:      "bg-stone-100 text-stone-600 border-stone-200",
  staging:  "bg-blue-50   text-blue-700  border-blue-200",
  dwh:      "bg-purple-50 text-purple-700 border-purple-200",
  datamart: "bg-green-50  text-green-700  border-green-200",
  other:    "bg-gray-50   text-gray-600   border-gray-200",
};

type StackCard = {
  icon: string;
  name: string;
  role: string;
  description: string;
  badges: string[];
  link?: string;
};

const stack: StackCard[] = [
  {
    icon: "🐍",
    name: "Python — Scraper",
    role: "Data collection",
    description:
      "Playwright-based scraper that crawls European online shops monthly, extracting product names, prices, image URLs and currencies. Outputs are appended directly to BigQuery raw tables via the Python client library.",
    badges: ["Playwright", "google-cloud-bigquery", "GitHub Actions"],
  },
  {
    icon: "🧠",
    name: "Python — Image Similarity",
    role: "Product matching",
    description:
      "Matches identical products sold across different shops using DINOv2 (Facebook's Vision Transformer) for semantic image embeddings combined with colour-histogram similarity after background removal via rembg. A Union-Find algorithm groups matched pairs into stable global_product_id UUIDs.",
    badges: ["DINOv2", "rembg", "PyTorch", "Union-Find", "UUID5"],
  },
  {
    icon: "🔁",
    name: "dbt (data build tool)",
    role: "Data transformation",
    description:
      "Four-layer dbt project (raw → staging → dwh → datamart) running on BigQuery. Staging normalises prices to EUR and joins product groups. DWH implements SCD Type 2 for price history. Datamart aggregates monthly min/avg/max prices per global_product_id for the dashboard. The full model lineage DAG, column documentation, and 42 test results are published publicly via GitHub Pages — auto-updated by GitHub Actions on every pipeline run.",
    badges: ["dbt-bigquery", "SCD Type 2", "dbt_utils", "Views + Tables", "42 tests passing"],
    link: "https://atsushisakai-a11y.github.io/soy-sauce-tracker/#!/overview",
  },
  {
    icon: "🏗️",
    name: "Google BigQuery",
    role: "Cloud data warehouse",
    description:
      "All data lives in BigQuery (europe-west4). Four datasets mirror the dbt layers: raw, staging, dwh, datamart. The Next.js dashboard queries BigQuery directly from server components — no intermediate API cache needed.",
    badges: ["europe-west4", "4 datasets", "Service Account auth"],
  },
  {
    icon: "⚙️",
    name: "GitHub Actions",
    role: "Orchestration & CI/CD",
    description:
      "Seven numbered workflows run in sequence: 1. Scrape → 2. Image Similarity → 3–5. dbt layers → 6. dbt Docs → 7. Score Leads (propensity model). Each step sends a Telegram completion notification. HuggingFace model weights are cached across runs to avoid rate limits.",
    badges: ["7 workflows", "Telegram alerts", "HuggingFace cache", "GCP secrets"],
    link: `${GITHUB_URL}/actions`,
  },
  {
    icon: "🫙",
    name: "Telegram Soy Bot + Groq",
    role: "Lead capture & AI conversation",
    description:
      "A Telegram bot (python-telegram-bot v20) that holds a free-flowing multi-turn conversation powered by Groq's llama-3.3-70b-versatile model (free tier, 14,400 req/day). The bot naturally guides users through five topics — motivation, favourite brand, dishes, origin country, and market outlook — before asking for their email. All answers are stored in BigQuery. Hosted on Railway with auto-deploy from GitHub.",
    badges: ["python-telegram-bot", "Groq LLM", "llama-3.3-70b", "Railway", "BigQuery"],
  },
  {
    icon: "📊",
    name: "Python — Propensity Model",
    role: "Lead scoring",
    description:
      "A Groq-powered scoring model that reads the full conversation history and extracts five structured dimensions (1–5 each): soy engagement (30%), cooking frequency (25%), brand awareness (20%), market sentiment (15%), and cultural affinity (10%). The weighted average is normalised to 0–100. Runs in real-time when a user submits their email, with a nightly GitHub Actions batch job as a safety net for any missed scores.",
    badges: ["Groq LLM", "Weighted scoring", "json-repair", "GitHub Actions", "0–100 scale"],
    link: `${GITHUB_URL}/blob/main/bot/scoring_model.py`,
  },
  {
    icon: "🤖",
    name: "Claude Code",
    role: "AI-assisted development",
    description:
      "The entire pipeline — from scraper to similarity algorithm to dbt models to this dashboard — was built iteratively with Claude Code. Claude Code handled Snowflake→BigQuery migration, debugging dbt SCD logic, tuning DINOv2 + colour-histogram weights, and writing all Next.js components.",
    badges: ["Anthropic Claude", "Pair programming", "Full-stack"],
    link: "https://claude.ai/code",
  },
  {
    icon: "🌐",
    name: "Next.js + Recharts",
    role: "This dashboard",
    description:
      "Server-rendered Next.js 14 app (App Router) that fetches data from BigQuery at build time (ISR, 1-hour revalidation). Recharts renders the price trend line chart and min/avg/max bar chart. Deployed on Vercel with credentials passed as environment variables.",
    badges: ["Next.js 14", "Recharts", "Tailwind CSS", "Vercel", "TypeScript"],
    link: GITHUB_URL,
  },
];

const pipeline = [
  { step: "1", label: "Scrape", detail: "Python + Playwright", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { step: "2", label: "Image Similarity", detail: "DINOv2 + rembg", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { step: "3", label: "dbt Staging", detail: "Normalise + join", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { step: "4", label: "dbt DWH", detail: "SCD Type 2", color: "bg-teal-100 text-teal-700 border-teal-200" },
  { step: "5", label: "dbt Datamart", detail: "Monthly agg", color: "bg-green-100 text-green-700 border-green-200" },
  { step: "6", label: "dbt Docs", detail: "GitHub Pages", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { step: "7", label: "Score Leads", detail: "Propensity model (To be added)", color: "bg-rose-100 text-rose-700 border-rose-200" },
  { step: "→", label: "Dashboard", detail: "Next.js + Recharts", color: "bg-amber-100 text-amber-700 border-amber-200" },
];

export default function TechPage() {
  const dbt = loadDbtSummary();
  const dbtByLayer: Record<string, TestResult[]> = {};
  if (dbt) {
    for (const t of dbt.tests) {
      const l = layerFromModel(t.model);
      if (!dbtByLayer[l]) dbtByLayer[l] = [];
      dbtByLayer[l].push(t);
    }
  }
  const allPass = dbt ? dbt.failed === 0 && dbt.warned === 0 : false;

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-12">

        {/* Hero */}
        <section className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-stone-900">How It's Built</h2>
          <p className="text-stone-500 max-w-2xl mx-auto leading-relaxed">
            An end-to-end data engineering project — from web scraping to a live public dashboard —
            built entirely with open-source tools and AI-assisted development.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-stone-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              View on GitHub
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              📊 See the Dashboard
            </Link>
          </div>
        </section>

        {/* Live links */}
        <section>
          <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-4 text-center">
            Live Public Links
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "📊",
                label: "Price Dashboard",
                description: "Live price trends and comparisons across European shops",
                href: "/",
                internal: true,
                color: "border-amber-200 bg-amber-50 hover:bg-amber-100",
                labelColor: "text-amber-700",
              },
              {
                icon: "🔀",
                label: "dbt Lineage DAG",
                description: "Full model lineage, column docs & 42 test results — auto-published via GitHub Pages on every pipeline run",
                href: "https://atsushisakai-a11y.github.io/soy-sauce-tracker/#!/overview",
                internal: false,
                color: "border-orange-200 bg-orange-50 hover:bg-orange-100",
                labelColor: "text-orange-700",
              },
              {
                icon: "💻",
                label: "GitHub Repository",
                description: "Full source code — scraper, DINOv2 similarity, dbt models, and this Next.js dashboard",
                href: "https://github.com/atsushisakai-a11y/soy-sauce-tracker",
                internal: false,
                color: "border-stone-200 bg-stone-50 hover:bg-stone-100",
                labelColor: "text-stone-700",
              },
            ].map((l) =>
              l.internal ? (
                <Link key={l.label} href={l.href}
                  className={`border rounded-2xl p-5 flex flex-col gap-2 transition-colors ${l.color}`}>
                  <span className="text-2xl">{l.icon}</span>
                  <span className={`font-semibold text-sm ${l.labelColor}`}>{l.label}</span>
                  <p className="text-xs text-stone-500 leading-relaxed">{l.description}</p>
                </Link>
              ) : (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                  className={`border rounded-2xl p-5 flex flex-col gap-2 transition-colors ${l.color}`}>
                  <span className="text-2xl">{l.icon}</span>
                  <span className={`font-semibold text-sm ${l.labelColor}`}>{l.label} ↗</span>
                  <p className="text-xs text-stone-500 leading-relaxed">{l.description}</p>
                </a>
              )
            )}
          </div>
        </section>

        {/* Pipeline flow */}
        <section>
          <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-4 text-center">
            Data Pipeline
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {pipeline.map((s, i) => (
              <div key={s.step} className="flex items-center gap-2">
                <div className={`border rounded-xl px-4 py-2.5 text-center ${s.color}`}>
                  <div className="text-xs font-bold opacity-60 mb-0.5">Step {s.step}</div>
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{s.detail}</div>
                </div>
                {i < pipeline.length - 1 && (
                  <span className="text-stone-300 text-lg font-light">→</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-stone-400 mt-3">
            Orchestrated by <strong>GitHub Actions</strong> · steps 1–5 run monthly · step 7 runs nightly · Telegram alerts on completion
          </p>
        </section>

        {/* Stack cards */}
        <section>
          <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-widest mb-6 text-center">
            Technical Stack
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {stack.map((s) => (
              <div
                key={s.name}
                className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{s.icon}</span>
                    <div>
                      <h4 className="font-semibold text-stone-900 text-sm">{s.name}</h4>
                      <p className="text-xs text-amber-600 font-medium">{s.role}</p>
                    </div>
                  </div>
                  {s.link && (
                    <a
                      href={s.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-stone-400 hover:text-stone-700 underline underline-offset-2 flex-shrink-0"
                    >
                      ↗ link
                    </a>
                  )}
                </div>
                <p className="text-sm text-stone-600 leading-relaxed">{s.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {s.badges.map((b) => (
                    <span
                      key={b}
                      className="text-xs bg-stone-100 text-stone-600 rounded-md px-2 py-0.5 font-medium"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* GitHub CTA */}
        <section className="bg-stone-900 rounded-2xl p-8 text-center text-white space-y-4">
          <h3 className="text-xl font-bold">All code is open source</h3>
          <p className="text-stone-400 text-sm max-w-lg mx-auto">
            Scraper, similarity algorithm, dbt models, and this dashboard are all in one public GitHub repository.
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-stone-900 px-6 py-3 rounded-xl text-sm font-semibold hover:bg-stone-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            atsushisakai-a11y / soy-sauce-tracker
          </a>
        </section>

        {/* Image Similarity — Step 2 */}
        <section className="space-y-6">
          <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-widest text-center">
            Step 2 — Image Similarity · Deep Dive
          </h3>

          {/* Overview */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-4">
            <h4 className="font-semibold text-stone-900">Why image similarity?</h4>
            <p className="text-sm text-stone-600 leading-relaxed">
              The same physical bottle of Kikkoman soy sauce is sold under different product names across
              shops — one shop says <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-xs">Koikuchi Shoyu 150ML TD</span>,
              another says <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-xs">Kikkoman Soy Sauce Pour Bottle, 150ml</span>,
              a third says <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-xs">KIKKOMAN SOY SAUCE TAFELFLES 150 ML</span>.
              Name-matching alone fails because the overlap is too small. Image similarity solves this:
              photographs of identical SKUs are near-identical once background and liquid are stripped, regardless
              of language or capitalisation.
            </p>
          </div>

          {/* Image preprocessing */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-4">
            <h4 className="font-semibold text-stone-900">Step A — Image preprocessing</h4>
            <p className="text-sm text-stone-500 leading-relaxed">
              Raw product photos contain shop-specific backgrounds, props, and the dark soy sauce liquid
              visible through the glass bottle. Both confound the model. Two preprocessing steps normalise
              every image before any similarity is computed.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-rose-100 bg-rose-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">① Background removal · rembg</p>
                <p className="text-xs text-stone-600 leading-relaxed">
                  <span className="font-mono bg-white border border-stone-100 px-1 rounded">rembg</span> runs a
                  U2Net deep-segmentation model that isolates the foreground product and composites it onto
                  a plain white canvas. This removes shop-specific backgrounds, coloured gradients, and
                  decorative props that would otherwise inflate or deflate cosine similarity unrelated to
                  the product itself.
                </p>
              </div>
              <div className="border border-orange-100 bg-orange-50 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">② Dark-liquid removal</p>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Every soy sauce bottle contains the same near-black liquid visible through the glass.
                  Pixels where R, G and B are all below 60 are replaced with white. Without this step the
                  liquid dominates DINOv2&apos;s embedding, making every soy sauce bottle look similar.
                  After removal the model compares only discriminative features: <strong>bottle shape,
                  label design, and lid colour</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Image comparison */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-5">
            <h4 className="font-semibold text-stone-900">Step B — Image comparison (two parallel signals)</h4>
            <p className="text-sm text-stone-500">
              Two independent visual signals are computed and combined. Neither alone is sufficient: DINOv2
              is colour-agnostic; the histogram is insensitive to shape. Together they catch both failure modes.
            </p>

            {/* DINOv2 */}
            <div className="border border-purple-100 rounded-xl overflow-hidden">
              <div className="bg-purple-50 px-5 py-3 border-b border-purple-100 flex items-center gap-3">
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">Signal 1 — DINOv2 structural similarity</span>
              </div>
              <div className="p-5 space-y-3">
                <div className="bg-stone-50 rounded-lg p-3 font-mono text-sm text-stone-700 space-y-1">
                  <p>embedding = DINOv2_CLS_token(preprocessed_image)  <span className="text-stone-400 font-sans text-xs">← 768-dim vector</span></p>
                  <p>dino_score = cosine_similarity(embedding_A, embedding_B)</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-purple-50 rounded-lg p-3 space-y-1">
                    <p className="font-semibold text-purple-800">Model</p>
                    <p className="text-stone-600"><span className="font-mono">facebook/dinov2-base</span> Vision Transformer (~330 MB, loaded once at startup)</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 space-y-1">
                    <p className="font-semibold text-purple-800">What it captures</p>
                    <p className="text-stone-600">Bottle shape, label layout and text arrangement. Self-supervised — not biased toward semantic categories.</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3 space-y-1">
                    <p className="font-semibold text-purple-800">Weakness</p>
                    <p className="text-stone-600">Largely colour-agnostic. A green-label and red-label bottle of the same shape score ~0.89 — too high without colour correction.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Colour histogram */}
            <div className="border border-amber-100 rounded-xl overflow-hidden">
              <div className="bg-amber-50 px-5 py-3 border-b border-amber-100">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Signal 2 — Colour histogram similarity</span>
              </div>
              <div className="p-5 space-y-3">
                <div className="bg-stone-50 rounded-lg p-3 font-mono text-sm text-stone-700 space-y-1">
                  <p>hist = RGB_histogram(coloured_pixels_only, bins=32)  <span className="text-stone-400 font-sans text-xs">← 96-dim vector</span></p>
                  <p>color_score = cosine_similarity(hist_A, hist_B)</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-amber-50 rounded-lg p-3 space-y-1">
                    <p className="font-semibold text-amber-800">Coloured pixels only</p>
                    <p className="text-stone-600">Near-white pixels (background) and near-black pixels (residual liquid guard) are excluded. Only lid and label colour pixels enter the histogram.</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 space-y-1">
                    <p className="font-semibold text-amber-800">What it captures</p>
                    <p className="text-stone-600">Lid colour and label dominant colours. A green-lid vs red-lid bottle scores ~0.4 — well below any match threshold.</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 space-y-1">
                    <p className="font-semibold text-amber-800">Weakness</p>
                    <p className="text-stone-600">Insensitive to shape or layout. Cannot distinguish two different products with similar label palettes.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Combined */}
            <div className="bg-stone-900 rounded-xl p-5 space-y-3 text-white">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Combined image score — geometric mean</p>
              <p className="text-2xl font-mono font-bold">image_score = √( dino_score × color_score )</p>
              <p className="text-xs text-stone-400 leading-relaxed">
                Geometric mean is chosen over arithmetic mean so that a near-zero on either signal collapses
                the whole score toward zero. Example: DINOv2 = 0.89 (same shape), colour = 0.40 (different lid) →
                image_score = √(0.89 × 0.40) ≈ <strong className="text-white">0.60</strong> — below the 0.80 base threshold → <strong className="text-red-400">IS_MATCH = False</strong>.
              </p>
            </div>
          </div>

          {/* Name comparison + penalties */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-5">
            <h4 className="font-semibold text-stone-900">Step C — Name comparison (hard stops &amp; threshold adjustment)</h4>
            <p className="text-sm text-stone-500 leading-relaxed">
              Product names are never used to increase a score — only to disqualify a pair or to lower
              the match threshold when structural text confirms the match. This avoids the old
              multiplicative-penalty approach that could accidentally suppress valid matches.
            </p>

            {/* Jaccard + aliases */}
            <div className="border border-stone-100 rounded-xl overflow-hidden">
              <div className="bg-stone-50 px-5 py-3 border-b border-stone-100">
                <span className="text-xs font-bold text-stone-600 uppercase tracking-wide">Name normalisation via NAME_ALIASES</span>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-xs text-stone-500 leading-relaxed">
                  Before any text check, both product names are normalised through an alias table that maps
                  alternate-language or alternate-romanisation forms to a canonical English token. This ensures
                  brand detection and Jaccard similarity work across language boundaries.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-stone-100">
                        <th className="text-left py-1.5 pr-4 text-stone-400 font-medium">Raw name fragment</th>
                        <th className="text-left py-1.5 pr-4 text-stone-400 font-medium">→ Canonical form</th>
                        <th className="text-left py-1.5 text-stone-400 font-medium">Why</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {[
                        ["sojasaus",       "soy sauce",     "Dutch for soy sauce — Jaccard token overlap without alias is near zero"],
                        ["gen’en / genen", "reduced salt",  "減塩 — Kikkoman Gen’en line; triggers the QUALIFIER_TERMS reduced-salt hard stop"],
                        ["healthy boy",    "dek som boon",  "Same Thai brand, different-language name; brand-conflict detection works correctly after alias"],
                      ].map(([raw, canon, why]) => (
                        <tr key={raw}>
                          <td className="py-2 pr-4 font-mono text-stone-700 align-top">{raw}</td>
                          <td className="py-2 pr-4 font-mono text-teal-700 align-top">{canon}</td>
                          <td className="py-2 text-stone-400 align-top leading-relaxed">{why}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-stone-600 leading-relaxed">
                <span className="font-bold text-amber-700">Note — KIKKOMAN_PRODUCT_TERMS (not in the alias table above):</span>{" "}
                <span className="font-mono">koikuchi shoyu</span> (濃口醤油) is a generic Japanese product-type term that any brand may use.
                A global alias to <em>kikkoman soy sauce</em> would silently inject &ldquo;kikkoman&rdquo; into
                a name like <span className="font-mono bg-white border border-stone-100 px-1 rounded">Yamasa Koikuchi Shoyu</span>,
                causing brand-conflict detection to fail. Instead it lives in a separate{" "}
                <span className="font-mono">KIKKOMAN_PRODUCT_TERMS</span> list that is only consulted when
                no other known brand is already present in the name.
              </div>
            </div>

            {/* Hard stops diagram */}
            <div className="border border-red-100 rounded-xl overflow-hidden">
              <div className="bg-red-50 px-5 py-3 border-b border-red-100">
                <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Hard stops — any one → IS_MATCH = False (regardless of image score)</span>
              </div>
              <div className="p-4 bg-white">
                <svg viewBox="0 0 720 400" xmlns="http://www.w3.org/2000/svg" role="img" className="w-full">
                  <title>Hard stop decision flow</title>
                  <desc>Flowchart showing four sequential hard stop checks that each veto a product pair match before the image score is consulted.</desc>
                  <rect width="720" height="400" fill="#fafaf9" rx="12"/>
                  {/* Title */}
                  <text x="360" y="30" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1c1917" fontFamily="ui-sans-serif,sans-serif">hard_stop — Domain-Knowledge Gates</text>
                  <text x="360" y="48" textAnchor="middle" fontSize="10.5" fill="#a8a29e" fontFamily="ui-sans-serif,sans-serif">Any single veto disqualifies the pair regardless of image score</text>
                  {/* Entry box */}
                  <rect x="10" y="68" width="88" height="42" rx="8" fill="#e7e5e4" stroke="#d6d3d1" strokeWidth="1.2"/>
                  <text x="54" y="85" textAnchor="middle" fontSize="10" fill="#57534e" fontFamily="ui-sans-serif,sans-serif">Name pair</text>
                  <text x="54" y="101" textAnchor="middle" fontSize="9" fill="#78716c" fontFamily="ui-sans-serif,sans-serif">A ↔ B</text>
                  <line x1="98" y1="89" x2="118" y2="89" stroke="#a8a29e" strokeWidth="1.5" markerEnd="url(#arr)"/>
                  {/* Gate 1 */}
                  <rect x="118" y="62" width="128" height="54" rx="8" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1.5"/>
                  <text x="182" y="80" textAnchor="middle" fontSize="10" fontWeight="700" fill="#c2410c" fontFamily="ui-sans-serif,sans-serif">EXCLUSIVE_PAIRS</text>
                  <text x="182" y="95" textAnchor="middle" fontSize="9" fill="#9a3412" fontFamily="ui-sans-serif,sans-serif">dark ↔ light</text>
                  <text x="182" y="108" textAnchor="middle" fontSize="9" fill="#9a3412" fontFamily="ui-sans-serif,sans-serif">sweet ↔ tamari  …</text>
                  <line x1="246" y1="89" x2="266" y2="89" stroke="#a8a29e" strokeWidth="1.5" markerEnd="url(#arr)"/>
                  <text x="256" y="84" textAnchor="middle" fontSize="8.5" fill="#a8a29e" fontFamily="ui-sans-serif,sans-serif">pass</text>
                  {/* Gate 2 */}
                  <rect x="266" y="62" width="128" height="54" rx="8" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1.5"/>
                  <text x="330" y="80" textAnchor="middle" fontSize="10" fontWeight="700" fill="#c2410c" fontFamily="ui-sans-serif,sans-serif">QUALIFIER_TERMS</text>
                  <text x="330" y="95" textAnchor="middle" fontSize="9" fill="#9a3412" fontFamily="ui-sans-serif,sans-serif">tamari / gyoza / ponzu</text>
                  <text x="330" y="108" textAnchor="middle" fontSize="9" fill="#9a3412" fontFamily="ui-sans-serif,sans-serif">reduced salt  …</text>
                  <line x1="394" y1="89" x2="414" y2="89" stroke="#a8a29e" strokeWidth="1.5" markerEnd="url(#arr)"/>
                  <text x="404" y="84" textAnchor="middle" fontSize="8.5" fill="#a8a29e" fontFamily="ui-sans-serif,sans-serif">pass</text>
                  {/* Gate 3 */}
                  <rect x="414" y="62" width="120" height="54" rx="8" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1.5"/>
                  <text x="474" y="80" textAnchor="middle" fontSize="10" fontWeight="700" fill="#c2410c" fontFamily="ui-sans-serif,sans-serif">Volume</text>
                  <text x="474" y="95" textAnchor="middle" fontSize="9" fill="#9a3412" fontFamily="ui-sans-serif,sans-serif">150 ml ≠ 1 L</text>
                  <text x="474" y="108" textAnchor="middle" fontSize="9" fill="#9a3412" fontFamily="ui-sans-serif,sans-serif">diff &gt; 5% → veto</text>
                  <line x1="534" y1="89" x2="554" y2="89" stroke="#a8a29e" strokeWidth="1.5" markerEnd="url(#arr)"/>
                  <text x="544" y="84" textAnchor="middle" fontSize="8.5" fill="#a8a29e" fontFamily="ui-sans-serif,sans-serif">pass</text>
                  {/* Gate 4 */}
                  <rect x="554" y="62" width="120" height="54" rx="8" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1.5"/>
                  <text x="614" y="80" textAnchor="middle" fontSize="10" fontWeight="700" fill="#c2410c" fontFamily="ui-sans-serif,sans-serif">Brand conflict</text>
                  <text x="614" y="95" textAnchor="middle" fontSize="9" fill="#9a3412" fontFamily="ui-sans-serif,sans-serif">Kikkoman ≠ Yamasa</text>
                  <text x="614" y="108" textAnchor="middle" fontSize="9" fill="#9a3412" fontFamily="ui-sans-serif,sans-serif">_detect_brands()</text>
                  {/* Veto arrows */}
                  <line x1="182" y1="116" x2="182" y2="155" stroke="#ef4444" strokeWidth="1.4" strokeDasharray="3 2" markerEnd="url(#arrRed)"/>
                  <line x1="330" y1="116" x2="330" y2="155" stroke="#ef4444" strokeWidth="1.4" strokeDasharray="3 2" markerEnd="url(#arrRed)"/>
                  <line x1="474" y1="116" x2="474" y2="155" stroke="#ef4444" strokeWidth="1.4" strokeDasharray="3 2" markerEnd="url(#arrRed)"/>
                  <line x1="614" y1="116" x2="614" y2="155" stroke="#ef4444" strokeWidth="1.4" strokeDasharray="3 2" markerEnd="url(#arrRed)"/>
                  <text x="198" y="140" fontSize="8.5" fill="#ef4444" fontFamily="ui-sans-serif,sans-serif">veto</text>
                  <text x="346" y="140" fontSize="8.5" fill="#ef4444" fontFamily="ui-sans-serif,sans-serif">veto</text>
                  <text x="490" y="140" fontSize="8.5" fill="#ef4444" fontFamily="ui-sans-serif,sans-serif">veto</text>
                  <text x="630" y="140" fontSize="8.5" fill="#ef4444" fontFamily="ui-sans-serif,sans-serif">veto</text>
                  {/* IS_MATCH=False bar */}
                  <rect x="100" y="155" width="580" height="38" rx="8" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1.2"/>
                  <text x="390" y="170" textAnchor="middle" fontSize="11" fontWeight="700" fill="#dc2626" fontFamily="ui-monospace,monospace">IS_MATCH = False</text>
                  <text x="390" y="185" textAnchor="middle" fontSize="9.5" fill="#b91c1c" fontFamily="ui-sans-serif,sans-serif">image score never consulted — domain knowledge overrides vision</text>
                  {/* All pass branch */}
                  <text x="688" y="89" textAnchor="middle" fontSize="8.5" fill="#16a34a" fontFamily="ui-sans-serif,sans-serif">all</text>
                  <text x="688" y="100" textAnchor="middle" fontSize="8.5" fill="#16a34a" fontFamily="ui-sans-serif,sans-serif">pass</text>
                  <line x1="674" y1="89" x2="706" y2="89" stroke="#16a34a" strokeWidth="1.4"/>
                  <line x1="706" y1="89" x2="706" y2="230" stroke="#16a34a" strokeWidth="1.4"/>
                  <line x1="706" y1="230" x2="570" y2="230" stroke="#16a34a" strokeWidth="1.4" markerEnd="url(#arrGreen)"/>
                  {/* Image score box */}
                  <rect x="290" y="215" width="278" height="44" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5"/>
                  <text x="429" y="233" textAnchor="middle" fontSize="10" fontWeight="700" fill="#15803d" fontFamily="ui-monospace,monospace">image_score ≥ threshold?</text>
                  <text x="429" y="249" textAnchor="middle" fontSize="9" fill="#16a34a" fontFamily="ui-sans-serif,sans-serif">√(DINOv2 × colour_hist) vs 0.60 / 0.80</text>
                  {/* Yes / No branches */}
                  <line x1="369" y1="259" x2="310" y2="290" stroke="#16a34a" strokeWidth="1.4" markerEnd="url(#arrGreen)"/>
                  <text x="323" y="277" fontSize="8.5" fill="#16a34a" fontFamily="ui-sans-serif,sans-serif">yes</text>
                  <line x1="489" y1="259" x2="548" y2="290" stroke="#ef4444" strokeWidth="1.4" markerEnd="url(#arrRed)"/>
                  <text x="525" y="277" fontSize="8.5" fill="#ef4444" fontFamily="ui-sans-serif,sans-serif">no</text>
                  {/* IS_MATCH True */}
                  <rect x="192" y="290" width="170" height="42" rx="8" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5"/>
                  <text x="277" y="309" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#15803d" fontFamily="ui-monospace,monospace">IS_MATCH = True</text>
                  <text x="277" y="324" textAnchor="middle" fontSize="9" fill="#16a34a" fontFamily="ui-sans-serif,sans-serif">→ Union-Find → global_product_id</text>
                  {/* IS_MATCH False (image) */}
                  <rect x="430" y="290" width="172" height="42" rx="8" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1.2"/>
                  <text x="516" y="309" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#dc2626" fontFamily="ui-monospace,monospace">IS_MATCH = False</text>
                  <text x="516" y="324" textAnchor="middle" fontSize="9" fill="#b91c1c" fontFamily="ui-sans-serif,sans-serif">score below threshold</text>
                  {/* Arrow defs */}
                  <defs>
                    <marker id="arr" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="#a8a29e"/>
                    </marker>
                    <marker id="arrRed" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444"/>
                    </marker>
                    <marker id="arrGreen" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="#16a34a"/>
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Hard stops detail panels */}
            <div className="border border-red-100 rounded-xl overflow-hidden">
              <div className="bg-red-50 px-5 py-3 border-b border-red-100">
                <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Hard stops — any one → IS_MATCH = False (regardless of image score)</span>
              </div>
              <div className="p-5 space-y-4">
                {[
                  {
                    name: "EXCLUSIVE_PAIRS",
                    color: "bg-red-50 border-red-200 text-red-800",
                    how: "12 pairs of mutually exclusive product-type terms. If name A contains one term and name B contains its opposite, they cannot be the same product.",
                    examples: [
                      ["dark", "light"],
                      ["sweet", "tamari"],
                      ["usukuchi", "koikuchi"],
                      ["asin", "manis"],
                    ],
                  },
                  {
                    name: "QUALIFIER_TERMS",
                    color: "bg-orange-50 border-orange-200 text-orange-800",
                    how: "13 use-specific qualifiers. If one name contains the qualifier and the other does not, the products serve different purposes.",
                    examples: [
                      ["tamari", "—"],
                      ["gyoza", "—"],
                      ["ponzu", "—"],
                      ["reduced salt", "—"],
                    ],
                  },
                  {
                    name: "Volume mismatch",
                    color: "bg-yellow-50 border-yellow-200 text-yellow-800",
                    how: "Both names specify a volume (ml or L) and they differ by more than 5%. Different sizes = different SKUs even if the product type is identical.",
                    examples: [["150ml", "1L"], ["250ml", "300ml"]],
                  },
                  {
                    name: "Brand conflict",
                    color: "bg-rose-50 border-rose-200 text-rose-800",
                    how: "Both names resolve to different known brands after alias normalisation. Different brands = definitely different products.",
                    examples: [["kikkoman", "yamasa"], ["kikkoman", "lee kum kee"]],
                  },
                ].map((hs) => (
                  <div key={hs.name} className={`border rounded-lg p-4 space-y-2 ${hs.color}`}>
                    <p className="text-xs font-bold font-mono">{hs.name}</p>
                    <p className="text-xs leading-relaxed opacity-80">{hs.how}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {hs.examples.map(([a, b]) => (
                        <span key={a} className="text-xs bg-white bg-opacity-60 border border-current border-opacity-20 rounded px-2 py-0.5 font-mono">
                          {b === "—" ? `"${a}"` : `"${a}" vs "${b}"`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Adaptive threshold */}
            <div className="border border-teal-100 rounded-xl overflow-hidden">
              <div className="bg-teal-50 px-5 py-3 border-b border-teal-100">
                <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">Adaptive threshold — name lowers the bar when it confirms a match</span>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-stone-500 leading-relaxed">
                  If no hard stop fires, the match threshold adapts based on how much structural text confirmation exists.
                  The same brand + the same volume is strong evidence the two listings are the same SKU.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-1">
                    <p className="text-xs font-bold text-stone-600 uppercase tracking-wide">Default threshold</p>
                    <p className="text-3xl font-bold text-stone-800 font-mono">0.80</p>
                    <p className="text-xs text-stone-500">
                      Brand or volume not both confirmed. Calibrated from data: a known match
                      (two Yamasa 150ml listings with different names) scores ~0.81.
                    </p>
                  </div>
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-1">
                    <p className="text-xs font-bold text-teal-700 uppercase tracking-wide">Confirmed threshold</p>
                    <p className="text-3xl font-bold text-teal-700 font-mono">0.60</p>
                    <p className="text-xs text-stone-500">
                      Same brand <strong>and</strong> same volume both detected. Same SKU photographed at different
                      angles or labelled in a different language scores 0.55–0.70 and can still match.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Union-Find */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-4">
            <h4 className="font-semibold text-stone-900">Step D — Union-Find clustering → global_product_id</h4>
            <p className="text-sm text-stone-500 leading-relaxed">
              All <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-xs">IS_MATCH=True</span> pairs
              are fed into a Union-Find data structure. Transitivity is handled automatically: if A↔B and B↔C
              both match, all three are merged into one cluster even if A↔C was never directly compared or scored
              below threshold. Each cluster receives a <strong>deterministic UUID5</strong> keyed on the
              lexicographic root node string — the same cluster always produces the same UUID across reruns, so
              downstream tables remain stable when new scrape dates are added.
            </p>
            <div className="bg-stone-50 rounded-xl p-4 space-y-2 font-mono text-xs text-stone-600">
              <p>Shilla Market — Koikuchi Shoyu 150ML     ↔ Toko Asia — KIKKOMAN SOY SAUCE 150ML  (0.73 ✓)</p>
              <p>Toko Asia — KIKKOMAN SOY SAUCE 150ML     ↔ Tjin&apos;s Toko — Soy Sauce 150ml       (0.61 ✓)</p>
              <p>Tjin&apos;s Toko — Soy Sauce 150ml          ↔ Tjin&apos;s Toko — Pour Bottle 150ml       (same shop — skipped)</p>
              <p className="mt-2 text-green-700">→ Union-Find: all 4 listings → global_product_id = 9458878e-b263-50f2-8f51-6d15a4e7f8fc</p>
            </div>
          </div>

          {/* Ground Truth */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-5">
            <h4 className="font-semibold text-stone-900">Step E — Generating ground truth with Claude</h4>

            {/* Problem statement */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">Problem: how do you know the model is accurate?</p>
              <p className="text-sm text-stone-600 leading-relaxed">
                The similarity pipeline produces an <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-xs">IS_MATCH</span> verdict
                for every cross-shop product pair. But without labelled ground truth, there is no way to quantify
                how accurate those verdicts actually are — or to catch regressions when the model is tuned.
                Building a labelled dataset manually for ~500 pairs per scrape date would be both tedious and
                subjective.
              </p>
            </div>

            {/* Metrics */}
            <div className="border border-indigo-100 rounded-xl overflow-hidden">
              <div className="bg-indigo-50 px-5 py-3 border-b border-indigo-100">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Quantification — Recall / Precision / F1</span>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-xs text-stone-500 leading-relaxed">
                  With a ground truth set in hand, three standard binary-classification metrics measure the
                  quality of the similarity model end-to-end.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      label: "Recall",
                      formula: "TP / (TP + FN)",
                      example: "e.g. 90 / 100",
                      desc: "Of all truly matching pairs, how many did the model catch? A low recall means real matches are being missed.",
                      color: "bg-green-50 border-green-200 text-green-800",
                    },
                    {
                      label: "Precision",
                      formula: "TP / (TP + FP)",
                      example: "e.g. 90 / 95",
                      desc: "Of all pairs the model said match, how many actually do? A low precision means false positives are polluting the price comparisons.",
                      color: "bg-blue-50 border-blue-200 text-blue-800",
                    },
                    {
                      label: "F1",
                      formula: "2 × P × R / (P + R)",
                      example: "harmonic mean",
                      desc: "Single combined score. Useful when recall and precision need to be balanced — a model that flags everything has recall=1 but precision≈0.",
                      color: "bg-purple-50 border-purple-200 text-purple-800",
                    },
                  ].map((m) => (
                    <div key={m.label} className={`border rounded-xl p-4 space-y-1.5 ${m.color}`}>
                      <p className="text-xs font-bold uppercase tracking-wide">{m.label}</p>
                      <p className="text-lg font-bold font-mono">{m.formula}</p>
                      <p className="text-xs font-semibold opacity-60">{m.example}</p>
                      <p className="text-xs leading-relaxed opacity-75">{m.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Solution: Claude as oracle */}
            <div className="border border-amber-100 rounded-xl overflow-hidden">
              <div className="bg-amber-50 px-5 py-3 border-b border-amber-100">
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Solution — Groq (Llama 3.2 Vision) as an independent oracle</span>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-stone-600 leading-relaxed">
                  <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-xs">similarity/generate_ground_truth.py</span> replaces
                  manual labelling entirely. It queries all distinct cross-shop pairs from BigQuery (latest
                  scrape date only), downloads both product images, and asks <strong>Llama 3.2 Vision via Groq</strong> —
                  the same API already powering the Telegram bot — to render a verdict for each pair.
                </p>

                {/* Why Groq / Llama Vision */}
                <div className="border border-amber-200 rounded-xl overflow-hidden">
                  <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Why Groq / Llama 3.2 Vision?</span>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {[
                      {
                        icon: "🔍",
                        title: "Reads text inside the image",
                        body: "Llama Vision extracts brand names, product type labels, and volume text printed on the bottle — information DINOv2 treats as just another patch of pixels. A label saying \"150ml\" or \"Gen'en\" is decisive evidence the model can act on.",
                      },
                      {
                        icon: "🧠",
                        title: "Cross-language domain knowledge",
                        body: "The model understands that 亀甲万 = Kikkoman, 濃口醤油 = regular dark soy sauce, and that \"tamari\" and \"regular\" are different product categories — without needing a hand-written alias table.",
                      },
                      {
                        icon: "🔀",
                        title: "Combines image and text in one judgment",
                        body: "The oracle receives both the product name string and the product image together, the same way a human would. It can reconcile a low-quality image with a clear product name, or override a confusing name with an obvious visual.",
                      },
                      {
                        icon: "⚖️",
                        title: "Independent signal — no circular validation",
                        body: "The DINOv2 + colour-histogram pipeline never runs during ground truth generation. Because the two systems use completely different reasoning paths, Llama&apos;s verdicts are genuine external labels — not a re-scoring of the same features.",
                      },
                      {
                        icon: "🆓",
                        title: "Free tier — already integrated",
                        body: "Groq's free tier is genuinely free, no billing required. The same GROQ_API_KEY already used by the Telegram bot scoring pipeline is reused here — zero additional setup.",
                      },
                      {
                        icon: "📏",
                        title: "Consistent and repeatable",
                        body: "Unlike manual labelling — which suffers from annotator fatigue and inter-rater disagreement — the model applies the same prompt and reasoning to every pair. Re-running the script produces the same distribution of verdicts.",
                      },
                    ].map((r) => (
                      <div key={r.title} className="flex gap-3">
                        <span className="text-base flex-shrink-0 mt-0.5">{r.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-stone-700">{r.title}</p>
                          <p className="text-xs text-stone-500 leading-relaxed mt-0.5">{r.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cost */}
                <div className="border border-emerald-100 rounded-xl overflow-hidden">
                  <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-100">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Cost — ~500 pairs per run</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-stone-500 leading-relaxed">
                      Each API call sends two product images plus a short text prompt.
                      Output is a single word. Llama 3.2 Vision via Groq free tier is used — the same API key already in use for the Telegram bot scoring pipeline.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-stone-100">
                            <th className="text-left py-1.5 pr-4 text-stone-400 font-medium">Item</th>
                            <th className="text-right py-1.5 pr-4 text-stone-400 font-medium">Limit</th>
                            <th className="text-right py-1.5 pr-4 text-stone-400 font-medium">Usage (~500 pairs)</th>
                            <th className="text-right py-1.5 text-stone-400 font-medium">Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          <tr>
                            <td className="py-2 pr-4 text-stone-600 align-top">Requests per minute</td>
                            <td className="py-2 pr-4 text-right font-mono text-stone-600 align-top">~30 RPM</td>
                            <td className="py-2 pr-4 text-right font-mono text-stone-600 align-top">~28/min (2s delay)</td>
                            <td className="py-2 text-right font-mono text-emerald-700 align-top font-bold">$0</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 text-stone-600 align-top">Requests per day</td>
                            <td className="py-2 pr-4 text-right font-mono text-stone-600 align-top">1,500/day</td>
                            <td className="py-2 pr-4 text-right font-mono text-stone-600 align-top">~500 (one run)</td>
                            <td className="py-2 text-right font-mono text-emerald-700 align-top font-bold">$0</td>
                          </tr>
                          <tr>
                            <td className="py-2 pr-4 text-stone-600 align-top">Run duration</td>
                            <td className="py-2 pr-4 text-right font-mono text-stone-600 align-top">—</td>
                            <td className="py-2 pr-4 text-right font-mono text-stone-600 align-top">~18 min</td>
                            <td className="py-2 text-right font-mono text-emerald-700 align-top font-bold">$0</td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-stone-200">
                            <td colSpan={3} className="pt-2 pr-4 text-xs font-bold text-stone-700">Total per full run</td>
                            <td className="pt-2 text-right font-bold font-mono text-emerald-700 text-base">Free</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-stone-600 leading-relaxed">
                      <span className="font-bold text-emerald-700">Free tier: </span>
                      Groq free tier (Llama 3.2 Vision) — ~30 requests/min, no billing required.
                      A full run of ~500 pairs takes roughly 18 minutes and costs nothing. Ground truth only needs to be regenerated when the product catalogue grows
                      significantly or the similarity model is re-tuned — in practice a few times per year.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    { step: "1", label: "Fetch pairs", detail: "BigQuery — latest scrape date, cross-shop only", color: "bg-stone-100 text-stone-700 border-stone-200" },
                    { step: "2", label: "Download images", detail: "Both product photos as JPEG base64", color: "bg-blue-50 text-blue-700 border-blue-200" },
                    { step: "3", label: "Ask Claude", detail: "Names + images → SAME / DIFFERENT / UNCERTAIN", color: "bg-amber-50 text-amber-700 border-amber-200" },
                    { step: "4", label: "Write CSV", detail: "ground_truth.csv + ground_truth_uncertain.csv", color: "bg-green-50 text-green-700 border-green-200" },
                  ].map((s) => (
                    <div key={s.step} className={`border rounded-xl p-3 text-center ${s.color}`}>
                      <div className="text-xs font-bold opacity-50 mb-1">Step {s.step}</div>
                      <div className="font-semibold">{s.label}</div>
                      <div className="text-xs opacity-70 mt-1 leading-relaxed">{s.detail}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-stone-50 rounded-xl p-4 space-y-1.5">
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">Output</p>
                  <div className="space-y-1 font-mono text-xs text-stone-600">
                    <p><span className="text-green-700">ground_truth.csv</span>          — SAME + DIFFERENT verdicts (labelled ground truth for Recall / Precision / F1)</p>
                    <p><span className="text-amber-700">ground_truth_uncertain.csv</span> — pairs Claude could not judge confidently (for optional manual review)</p>
                  </div>
                </div>

                <div className="bg-stone-900 rounded-xl p-4 space-y-2 text-white">
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wide">One-shot execution — no manual work required</p>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    Triggered on demand via GitHub Actions workflow{" "}
                    <span className="font-mono bg-stone-700 px-1.5 py-0.5 rounded">92. Generate Ground Truth (Groq Vision Oracle)</span>.
                    A single run labels all ~500 pairs. The resulting CSVs are uploaded as build artifacts
                    and feed directly into{" "}
                    <span className="font-mono bg-stone-700 px-1.5 py-0.5 rounded">evaluate_matching.py</span>{" "}
                    to compute the final Recall / Precision / F1 scores.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* dbt Data Quality — Step 6 */}
        {dbt && (
          <section className="space-y-5">
            <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-widest text-center">
              Step 6 — dbt Data Quality
            </h3>

            {/* Scorecards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Models",  value: dbt.models,  color: "text-stone-900" },
                { label: "Tests",   value: dbt.total,   color: "text-stone-900" },
                { label: "Passed",  value: dbt.passed,  color: "text-green-600" },
                { label: "Failed",  value: dbt.failed,  color: dbt.failed > 0 ? "text-red-600" : "text-green-600" },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">{c.label}</p>
                  <p className={`text-4xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Status banner */}
            <div className={`rounded-2xl p-4 flex items-center gap-3 border ${
              allPass ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
            }`}>
              <span className="text-2xl">{allPass ? "✅" : "❌"}</span>
              <div>
                <p className="font-semibold text-sm">
                  {allPass
                    ? `All ${dbt.total} tests passing — data quality confirmed`
                    : `${dbt.failed} test(s) failing — review required`}
                </p>
                <p className="text-xs opacity-70 mt-0.5">
                  Last run: {formatDate(dbt.generated_at)} · {dbt.passed} passed · {dbt.failed} failed · {dbt.warned} warned
                </p>
              </div>
            </div>

            {/* Tests by layer */}
            {LAYER_ORDER.filter(l => dbtByLayer[l]?.length).map(layer => (
              <div key={layer} className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className={`px-5 py-3 flex items-center justify-between border-b ${LAYER_COLORS[layer]}`}>
                  <span className="text-xs font-bold uppercase tracking-widest">{layer}</span>
                  <span className="text-xs font-medium">
                    {dbtByLayer[layer].filter(t => t.status === "pass").length} / {dbtByLayer[layer].length} passed
                  </span>
                </div>
                <div className="divide-y divide-stone-50">
                  {dbtByLayer[layer].map(t => (
                    <div key={t.name} className="px-5 py-2.5 flex items-center justify-between gap-3 hover:bg-stone-50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`text-base flex-shrink-0 ${
                          t.status === "pass" ? "text-green-500"
                          : t.status === "warn" ? "text-amber-500"
                          : "text-red-500"
                        }`}>
                          {t.status === "pass" ? "✓" : t.status === "warn" ? "⚠" : "✗"}
                        </span>
                        <span className="text-xs font-mono text-stone-600 truncate">{t.name}</span>
                      </div>
                      <span className="text-xs text-stone-300 flex-shrink-0">{t.execution_time}s</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Lineage DAG CTA */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-6 flex items-start gap-4">
              <span className="text-3xl flex-shrink-0">🔀</span>
              <div className="flex-1 space-y-1">
                <h4 className="font-semibold text-stone-800">Interactive Lineage DAG — hosted on GitHub Pages</h4>
                <p className="text-sm text-stone-500 leading-relaxed">
                  Auto-generated by GitHub Actions on every pipeline run. Shows the full model dependency
                  graph (raw → staging → dwh → datamart), column-level docs, source freshness, and all test definitions.
                </p>
                <a
                  href="https://atsushisakai-a11y.github.io/soy-sauce-tracker/#!/overview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors mt-3"
                >
                  Open dbt Docs ↗
                </a>
              </div>
            </div>
          </section>
        )}

        <footer className="text-center text-xs text-stone-300 pb-4">
          Built with Claude Code · dbt · BigQuery · Next.js
        </footer>
      </div>
    </main>
  );
}
