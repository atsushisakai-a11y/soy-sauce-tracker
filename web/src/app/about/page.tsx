import Image from "next/image";

export const metadata = {
  title: "About – Atsushi Sakai",
  description: "Senior Data Platform Leader with 15+ years of experience building enterprise-wide data solutions.",
};

const highlights = [
  { icon: "🏗️", label: "Platform built", value: "GRID @ Just Eat Takeaway.com" },
  { icon: "🌍", label: "Countries served", value: "16 markets" },
  { icon: "👥", label: "Stakeholders", value: "100+" },
  { icon: "📅", label: "Experience", value: "15+ years" },
];

const skills = [
  { category: "Data Engineering", items: ["SQL", "ETL Pipelines", "dbt", "BigQuery", "Snowflake", "Python"] },
  { category: "Platform & Architecture", items: ["Semantic Layer Design", "KPI Governance", "Data Modelling", "SCD Type 2", "Medallion Architecture"] },
  { category: "Leadership", items: ["Multi-site Harmonisation", "Vendor Management", "Executive Reporting", "Data Governance", "AI Readiness"] },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-10">

        {/* Hero */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 h-28" />
          <div className="px-8 pb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 -mt-14">
              <div className="relative w-32 h-40 rounded-2xl border-4 border-white shadow-lg overflow-hidden flex-shrink-0 bg-stone-100">
                <Image
                  src="/atsushi.jpg"
                  alt="Atsushi Sakai"
                  fill
                  className="object-cover object-[center_10%]"
                  priority
                />
              </div>
              <div className="pt-4 sm:pt-0 sm:pb-1">
                <h1 className="text-2xl font-bold text-stone-900">Atsushi Sakai</h1>
                <p className="text-sm text-stone-500 mt-0.5">Senior Data Platform Leader</p>
                <a
                  href="https://www.linkedin.com/in/atsushi-sakai-7986015/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-[#0A66C2] text-white text-sm font-medium rounded-lg hover:bg-[#004182] transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn Profile
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {highlights.map((h) => (
            <div key={h.label} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 text-center">
              <div className="text-2xl mb-1">{h.icon}</div>
              <div className="text-sm font-bold text-stone-800">{h.value}</div>
              <div className="text-xs text-stone-400 mt-0.5">{h.label}</div>
            </div>
          ))}
        </div>

        {/* Bio */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8">
          <h2 className="text-base font-semibold text-stone-800 mb-4">About</h2>
          <div className="space-y-4 text-sm text-stone-600 leading-relaxed">
            <p>
              Senior data platform leader with 15+ years of hands-on experience building, scaling, and governing
              enterprise-wide data solutions across multi-market, complex operational environments.
            </p>
            <p>
              At <strong className="text-stone-800">Just Eat Takeaway.com</strong>, built and led <strong className="text-stone-800">GRID</strong> — a
              sophisticated, multi-layered data platform serving 16 countries and 100+ stakeholders. Owned end-to-end delivery
              from data ingestion and ETL architecture through semantic layer design, KPI governance, and executive reporting.
            </p>
            <p>
              Proven ability to deliver high-ownership roles in fast-growing organisations: combining hands-on technical delivery
              (SQL, ETL pipelines, data modelling) with strategic platform architecture, vendor management, and
              multi-site harmonisation.
            </p>
            <p>
              Skilled at embedding data governance, AI readiness, and compliance frameworks into platform foundations,
              and at translating data insights into measurable commercial value.
            </p>
            <p className="font-medium text-amber-700 border-l-2 border-amber-400 pl-4">
              Seeking a similarly high-impact platform leadership opportunity to bring business impact by data.
            </p>
          </div>
        </div>

        {/* Skills */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8">
          <h2 className="text-base font-semibold text-stone-800 mb-6">Skills & Expertise</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {skills.map((s) => (
              <div key={s.category}>
                <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-widest mb-3">{s.category}</h3>
                <div className="flex flex-wrap gap-2">
                  {s.items.map((item) => (
                    <span
                      key={item}
                      className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-medium"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* This project */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8">
          <h2 className="text-base font-semibold text-stone-800 mb-2">About This Project</h2>
          <p className="text-sm text-stone-500 mb-4">
            This dashboard is a live portfolio piece — built end-to-end to demonstrate the full data engineering stack.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {[
              ["🕷️", "Python scraper", "Playwright + BeautifulSoup"],
              ["🤖", "Image matching", "DINOv2 + rembg + Union-Find"],
              ["🔄", "Transforms", "dbt · 4-layer medallion"],
              ["🏬", "Warehouse", "Google BigQuery"],
              ["📊", "Dashboard", "Next.js + Recharts"],
              ["⚙️", "Orchestration", "GitHub Actions"],
            ].map(([icon, label, sub]) => (
              <div key={label} className="flex items-start gap-2 p-3 bg-stone-50 rounded-xl">
                <span className="text-lg leading-none">{icon}</span>
                <div>
                  <div className="font-medium text-stone-700">{label}</div>
                  <div className="text-stone-400 mt-0.5">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
