"use client";

import Image from "next/image";
import type { PriceRow } from "@/app/api/prices/route";
import { useMemo } from "react";

type ShopMeta = {
  flag: string;
  desc: string;
};

const SHOP_META: Record<string, ShopMeta> = {
  "Dun Yong": {
    flag: "🇳🇱",
    desc: "Amsterdam's largest Asian supermarket — established 1969, multiple city locations plus an online shop delivering across NL. Stocks an exceptional range of Japanese, Chinese, Korean and Southeast Asian soy sauces including premium and hard-to-find varieties.",
  },
  "Shilla Market": {
    flag: "🇳🇱",
    desc: "Korean-focused online shop based in the Netherlands. Strong range of Japanese and Korean specialty soy sauces with fast NL delivery.",
  },
  "Tjin's Toko": {
    flag: "🇳🇱",
    desc: "Rotterdam's oldest Asian grocery with one of the largest soy sauce ranges in the Netherlands — 10+ brands across Japanese, Chinese, Korean and Southeast Asian varieties. English website available.",
  },
  "Oriental Webshop": {
    flag: "🇳🇱",
    desc: "Dutch online Asian grocery with a broad selection across all Asian cuisines. Good source for hard-to-find specialty soy sauces.",
  },
  "Amazing Oriental": {
    flag: "🇳🇱",
    desc: "Chain of Asian supermarkets across the Netherlands. Reliable everyday stock of Chinese, Japanese, and Korean soy sauces.",
  },
  "Wah Nam Hong": {
    flag: "🇳🇱",
    desc: "Wholesale-oriented Asian food importer with retail locations in the Netherlands. Competitive pricing on Chinese brands.",
  },
  "NikanKitchen": {
    flag: "🇩🇪",
    desc: "Germany-based Japanese food specialist delivering across Europe. Curated selection of premium Japanese soy sauces and condiments.",
  },
  "Toko Dua Saudara": {
    flag: "🇳🇱",
    desc: "Traditional Dutch toko specialising in Indonesian and Southeast Asian groceries. Good source for kecap manis and Indonesian soy sauces.",
  },
  "ACE Market": {
    flag: "🇳🇱",
    desc: "Dutch online Asian supermarket with a focused soy sauce category. Stocks Japanese, Chinese, Thai, and Filipino brands.",
  },
  "Albert Heijn": {
    flag: "🇳🇱",
    desc: "The Netherlands' largest supermarket chain. Carries mainstream soy sauce brands at accessible prices — convenient for everyday shoppers.",
  },
  "Jumbo": {
    flag: "🇳🇱",
    desc: "Major Dutch supermarket chain. Limited but growing Asian sauce selection, competitively priced.",
  },
  "PLUS": {
    flag: "🇳🇱",
    desc: "Dutch supermarket cooperative. Carries a small selection of mainstream soy sauces.",
  },
  "Picnic": {
    flag: "🇳🇱",
    desc: "Dutch online-only grocery delivery service. Growing assortment of Asian sauces available for home delivery.",
  },
  "Bol.com": {
    flag: "🇳🇱",
    desc: "The Netherlands' largest online marketplace. Wide range of soy sauce brands including international sellers — prices vary widely.",
  },
};

function LogoBadge({ url, name }: { url: string; name: string }) {
  return (
    <div className="w-10 h-10 rounded-xl overflow-hidden border border-stone-100 bg-stone-50 flex items-center justify-center flex-shrink-0">
      <Image
        src={`https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`}
        alt={name}
        width={32}
        height={32}
        className="object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent) {
            parent.innerHTML = `<span class="text-xs font-bold text-stone-400">${name.slice(0, 2).toUpperCase()}</span>`;
          }
        }}
      />
    </div>
  );
}

type Props = { rows: PriceRow[] };

export default function ShopDirectory({ rows }: Props) {
  const shops = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (!map.has(r.shop_name) && r.product_url) {
        try {
          map.set(r.shop_name, new URL(r.product_url).origin);
        } catch {
          map.set(r.shop_name, "");
        }
      } else if (!map.has(r.shop_name)) {
        map.set(r.shop_name, "");
      }
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
      <h2 className="text-base font-semibold text-stone-800 mb-1">Shops</h2>
      <p className="text-xs text-stone-400 mb-5">
        {shops.length} shops tracked · click to visit
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {shops.map(([name, url]) => {
          const meta = SHOP_META[name];
          return (
            <a
              key={name}
              href={url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 p-3 rounded-xl border border-stone-100 hover:border-amber-300 hover:bg-amber-50/40 transition-colors group"
            >
              {url ? (
                <LogoBadge url={url} name={name} />
              ) : (
                <div className="w-10 h-10 rounded-xl border border-stone-100 bg-stone-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-stone-400">{name.slice(0, 2).toUpperCase()}</span>
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm font-semibold text-stone-800 group-hover:text-amber-700 transition-colors">
                    {name}
                  </span>
                  {meta && <span className="text-base leading-none">{meta.flag}</span>}
                  <svg className="w-3 h-3 text-stone-300 group-hover:text-amber-400 ml-auto flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                {meta && <p className="text-xs text-stone-400 leading-relaxed">{meta.desc}</p>}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
