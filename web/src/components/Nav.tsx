"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Nav() {
  const path = usePathname();

  const tabs = [
    { href: "/",                 label: "Dashboard" },
    { href: "/market",           label: "Market" },
    { href: "/exclusive-report", label: "Exclusive Report" },
    { href: "/tech",             label: "Tech Stack" },
    { href: "/about",            label: "About" },
  ];

  return (
    <header className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🫙</span>
          <div>
            <h1 className="text-lg font-bold text-stone-900 leading-tight">
              European Soy Sauce Price Tracker
            </h1>
            <p className="text-xs text-stone-400">
              Real prices scraped from European online shops · updated monthly
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-stone-100 rounded-xl p-1">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                path === t.href
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
