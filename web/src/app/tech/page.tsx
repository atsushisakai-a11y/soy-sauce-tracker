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
  { step: "7", label: "Score Leads", detail: "Propensity model", color: "bg-rose-100 text-rose-700 border-rose-200" },
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

        {/* Propensity model deep-dive */}
        <section className="space-y-6">
          <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-widest text-center">
            Step 7 — Propensity-to-Buy Model · Deep Dive
          </h3>

          {/* How it works */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-4">
            <h4 className="font-semibold text-stone-900">How it works</h4>
            <p className="text-sm text-stone-600 leading-relaxed">
              When a user finishes the Telegram conversation and submits their email, a second Groq
              LLM call reads the full chat history and returns a structured JSON object with five
              dimension scores (1–5). A weighted average is then normalised to a 0–100 propensity
              score. A nightly GitHub Actions job re-scores any leads the real-time scorer missed.
            </p>

            {/* Dimensions table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-stone-100">
                    <th className="text-left py-2 pr-4 text-stone-500 font-medium">Dimension</th>
                    <th className="text-left py-2 pr-4 text-stone-500 font-medium">Weight</th>
                    <th className="text-left py-2 text-stone-500 font-medium">What it measures</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {[
                    ["Soy engagement",    "30%", "Passion & knowledge about soy sauce"],
                    ["Cooking frequency", "25%", "Actively cooks dishes that need soy sauce"],
                    ["Brand awareness",   "20%", "Knows brands, has specific preferences"],
                    ["Market sentiment",  "15%", "Optimistic about European soy sauce market growth"],
                    ["Cultural affinity", "10%", "Background with soy sauce culinary tradition"],
                  ].map(([dim, weight, desc]) => (
                    <tr key={dim}>
                      <td className="py-2 pr-4 font-medium text-stone-800">{dim}</td>
                      <td className="py-2 pr-4">
                        <span className="bg-rose-100 text-rose-700 text-xs font-semibold px-2 py-0.5 rounded-md">{weight}</span>
                      </td>
                      <td className="py-2 text-stone-500">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Formula */}
            <div className="bg-stone-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Scoring formula</p>
              <p className="text-sm font-mono text-stone-700">
                raw = (0.30 × soy) + (0.25 × cooking) + (0.20 × brand) + (0.15 × market) + (0.10 × culture)
              </p>
              <p className="text-sm font-mono text-stone-700">
                propensity_score = (raw − 1) / 4 × 100
              </p>
              <p className="text-xs text-stone-400 mt-1">
                Normalises [1, 5] → [0, 100]. Unknown answers default to 2 (below average — uncertain, not worst-case).
              </p>
            </div>
          </div>

          {/* Real example */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-stone-900">Real example — first scored lead</h4>
              <span className="text-2xl font-bold text-rose-600">62.5 / 100</span>
            </div>
            <p className="text-xs text-stone-400">
              Conversation ended early (bot restarted mid-session), so cooking frequency and market
              sentiment were never answered — both defaulted to 2/5.
            </p>

            <div className="space-y-2">
              {[
                { dim: "Soy engagement",    score: 4, weight: "30%", reason: "Expressed love for soy sauce", calc: "0.30 × 4 = 1.20" },
                { dim: "Cooking frequency", score: 2, weight: "25%", reason: "No information provided",      calc: "0.25 × 2 = 0.50" },
                { dim: "Brand awareness",   score: 5, weight: "20%", reason: "Specifically named Kikkoman",  calc: "0.20 × 5 = 1.00" },
                { dim: "Market sentiment",  score: 2, weight: "15%", reason: "No information provided",      calc: "0.15 × 2 = 0.30" },
                { dim: "Cultural affinity", score: 5, weight: "10%", reason: "Japanese background",          calc: "0.10 × 5 = 0.50" },
              ].map((row) => (
                <div key={row.dim} className="flex items-center gap-3">
                  <div className="w-36 shrink-0">
                    <span className="text-xs font-medium text-stone-700">{row.dim}</span>
                  </div>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((i) => (
                      <div key={i} className={`w-4 h-4 rounded-sm ${i <= row.score ? "bg-rose-400" : "bg-stone-100"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-stone-500 w-6 shrink-0">{row.score}/5</span>
                  <span className="text-xs text-stone-400 hidden sm:block shrink-0">{row.weight} →</span>
                  <span className="text-xs font-mono text-stone-600 hidden sm:block shrink-0">{row.calc}</span>
                  <span className="text-xs text-stone-400 truncate">{row.reason}</span>
                </div>
              ))}
            </div>

            <div className="bg-stone-50 rounded-xl p-4 text-sm font-mono text-stone-700 space-y-1">
              <p>raw = 1.20 + 0.50 + 1.00 + 0.30 + 0.50 = <strong>3.50</strong></p>
              <p>score = (3.50 − 1) / 4 × 100 = <strong className="text-rose-600">62.5</strong></p>
            </div>

            <p className="text-xs text-stone-400">
              If cooking frequency and market sentiment had been answered (e.g. both 4/5), the score
              would rise to approximately <strong>78.8</strong> — illustrating the model&apos;s sensitivity
              to conversation completeness.
            </p>
          </div>
        </section>

        <footer className="text-center text-xs text-stone-300 pb-4">
          Built with Claude Code · dbt · BigQuery · Next.js
        </footer>
      </div>
    </main>
  );
}
