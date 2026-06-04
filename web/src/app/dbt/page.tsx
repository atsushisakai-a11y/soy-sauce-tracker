import fs from "fs";
import path from "path";

type TestResult = {
  name: string;
  model: string;
  status: "pass" | "fail" | "warn";
  execution_time: number;
};

type Summary = {
  generated_at: string;
  total: number;
  passed: number;
  failed: number;
  warned: number;
  models: number;
  tests: TestResult[];
};

function loadSummary(): Summary {
  const p = path.join(process.cwd(), "public/dbt-docs/summary.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
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
  other:    "bg-gray-50   text-gray-600  border-gray-200",
};

export default function DbtPage() {
  const s = loadSummary();
  const allPass = s.failed === 0 && s.warned === 0;

  // Group tests by layer
  const byLayer: Record<string, TestResult[]> = {};
  for (const t of s.tests) {
    const l = layerFromModel(t.model);
    if (!byLayer[l]) byLayer[l] = [];
    byLayer[l].push(t);
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-stone-900">dbt Data Quality</h2>
            <p className="text-sm text-stone-400 mt-1">
              Last run: {formatDate(s.generated_at)}
            </p>
          </div>
          <a
            href="https://atsushisakai-a11y.github.io/soy-sauce-tracker/#!/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <span>🔗</span> Open Full Lineage DAG
          </a>
        </div>

        {/* Scorecards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Models",       value: s.models,  color: "text-stone-900" },
            { label: "Tests",        value: s.total,   color: "text-stone-900" },
            { label: "Passed",       value: s.passed,  color: "text-green-600" },
            { label: "Failed",       value: s.failed,  color: s.failed > 0 ? "text-red-600" : "text-green-600" },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">{c.label}</p>
              <p className={`text-4xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Overall status banner */}
        <div className={`rounded-2xl p-4 flex items-center gap-3 border ${
          allPass
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          <span className="text-2xl">{allPass ? "✅" : "❌"}</span>
          <div>
            <p className="font-semibold text-sm">
              {allPass
                ? `All ${s.total} tests passing — data quality confirmed`
                : `${s.failed} test(s) failing — review required`}
            </p>
            <p className="text-xs opacity-70 mt-0.5">
              {s.passed} passed · {s.failed} failed · {s.warned} warned
            </p>
          </div>
        </div>

        {/* Pipeline layers */}
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-stone-400 uppercase tracking-widest">
            Tests by Layer
          </h3>
          {LAYER_ORDER.filter(l => byLayer[l]?.length).map(layer => (
            <div key={layer} className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
              <div className={`px-5 py-3 flex items-center justify-between border-b ${LAYER_COLORS[layer]}`}>
                <span className="text-xs font-bold uppercase tracking-widest">{layer}</span>
                <span className="text-xs font-medium">
                  {byLayer[layer].filter(t => t.status === "pass").length} / {byLayer[layer].length} passed
                </span>
              </div>
              <div className="divide-y divide-stone-50">
                {byLayer[layer].map(t => (
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
        </div>

        {/* Lineage embed CTA */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">🔀</span>
            <div className="space-y-1">
              <h3 className="font-semibold text-stone-800">Interactive Lineage DAG — hosted on GitHub Pages</h3>
              <p className="text-sm text-stone-500 leading-relaxed">
                The full dbt docs site is auto-generated by GitHub Actions on every pipeline run and published publicly via GitHub Pages.
                It shows the complete model dependency graph (raw → staging → dwh → datamart),
                column-level documentation, source freshness, and all test definitions — useful for understanding how data flows through the pipeline.
              </p>
              <p className="text-xs font-mono text-stone-400 mt-1 break-all">
                https://atsushisakai-a11y.github.io/soy-sauce-tracker/#!/overview
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <a
              href="https://atsushisakai-a11y.github.io/soy-sauce-tracker/#!/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              Open dbt Docs ↗
            </a>
          </div>
        </div>

        <p className="text-xs text-stone-300 text-center pb-4">
          8 models · 4 layers (raw → staging → dwh → datamart) · BigQuery europe-west4
        </p>
      </div>
    </main>
  );
}
