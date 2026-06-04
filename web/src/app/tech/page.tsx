import Link from "next/link";

const GITHUB_URL = "https://github.com/atsushisakai-a11y/soy-sauce-tracker";

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
      "Five numbered workflows run in sequence: 1. Scrape → 2. Image Similarity → 3. dbt Staging → 4. dbt DWH → 5. dbt Datamart. Each step sends a Telegram completion notification. HuggingFace model weights are cached across runs to avoid rate limits.",
    badges: ["5 workflows", "Telegram alerts", "HuggingFace cache", "GCP secrets"],
    link: `${GITHUB_URL}/actions`,
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
  { step: "→", label: "Dashboard", detail: "Next.js + Recharts", color: "bg-amber-100 text-amber-700 border-amber-200" },
];

export default function TechPage() {
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
            Orchestrated by <strong>GitHub Actions</strong> · runs monthly · Telegram alerts on completion
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

        <footer className="text-center text-xs text-stone-300 pb-4">
          Built with Claude Code · dbt · BigQuery · Next.js
        </footer>
      </div>
    </main>
  );
}
