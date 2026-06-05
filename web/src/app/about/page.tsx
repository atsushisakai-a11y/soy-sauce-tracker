import Image from "next/image";

export const metadata = {
  title: "About – Atsushi Sakai",
  description: "Atsushi Sakai — builder of the European Soy Sauce Price Tracker.",
};

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
