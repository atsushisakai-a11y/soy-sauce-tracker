"use client";

import Image from "next/image";

type BrandMeta = {
  domain: string;
  flag: string;
  tag: string;
  tagColor: string;
  desc: string;
};

const BRAND_META: Record<string, BrandMeta> = {
  Kikkoman: {
    domain: "kikkoman.com",
    flag: "🇯🇵",
    tag: "Premium Japanese",
    tagColor: "bg-red-50 text-red-700 border-red-200",
    desc: "Japan's most iconic naturally-brewed soy sauce. Fermented for 5+ months; ubiquitous in European supermarkets and professional kitchens.",
  },
  Yamasa: {
    domain: "yamasa.com",
    flag: "🇯🇵",
    tag: "Traditional Japanese",
    tagColor: "bg-red-50 text-red-700 border-red-200",
    desc: "Founded in 1645 — one of Japan's oldest active brewers. Rich, balanced umami with a clean, lingering finish.",
  },
  Takesan: {
    domain: "takesan.co.jp",
    flag: "🇯🇵",
    tag: "Artisan Japanese",
    tagColor: "bg-red-50 text-red-700 border-red-200",
    desc: "Small-batch craft brewer from Shodoshima island. Kishibori Shoyu is hand-crafted in century-old cedar barrels — a collector's bottle.",
  },
  Marukin: {
    domain: "marukin.co.jp",
    flag: "🇯🇵",
    tag: "Japanese Specialty",
    tagColor: "bg-red-50 text-red-700 border-red-200",
    desc: "Hiroshima-based brewer since 1907. Specialises in reduced-salt and specialty shoyu varieties.",
  },
  "Lee Kum Kee": {
    domain: "lkk.com",
    flag: "🇭🇰",
    tag: "Hong Kong Classic",
    tagColor: "bg-purple-50 text-purple-700 border-purple-200",
    desc: "Hong Kong's most recognised sauce brand, founded 1888. Extensive range from premium light soy to dark and sweet varieties for Cantonese cooking.",
  },
  "Mee Chun": {
    domain: "meechun.com",
    flag: "🇭🇰",
    tag: "Hong Kong Value",
    tagColor: "bg-purple-50 text-purple-700 border-purple-200",
    desc: "Affordable Hong Kong light and dark soy sauces. Popular everyday choice for Southeast Asian home cooking.",
  },
  "Pearl River Bridge": {
    domain: "prb.com.cn",
    flag: "🇨🇳",
    tag: "Affordable Chinese",
    tagColor: "bg-yellow-50 text-yellow-700 border-yellow-200",
    desc: "Guangdong-based brand offering light and dark soy sauces at accessible prices. A Chinese-cooking staple found across European Asian supermarkets.",
  },
  Sempio: {
    domain: "sempio.com",
    flag: "🇰🇷",
    tag: "Korean",
    tagColor: "bg-blue-50 text-blue-700 border-blue-200",
    desc: "South Korea's leading soy sauce brand. Brewed from soybeans and wheat — essential for Korean BBQ, bibimbap, and jjigae.",
  },
  "Silver Swan": {
    domain: "silvanswan.com.ph",
    flag: "🇵🇭",
    tag: "Filipino",
    tagColor: "bg-sky-50 text-sky-700 border-sky-200",
    desc: "The Philippines' most popular soy sauce. Lighter and slightly sweeter than Japanese varieties, used in adobo and other Filipino classics.",
  },
  "Healthy Boy": {
    domain: "healthyboy.co.th",
    flag: "🇹🇭",
    tag: "Thai",
    tagColor: "bg-green-50 text-green-700 border-green-200",
    desc: "Thailand's go-to soy sauce brand. Thin (light) and black (dark) varieties are essential in pad thai, stir-fries, and Thai marinades.",
  },
  "Dek Som Boon": {
    domain: "deksom.com",
    flag: "🇹🇭",
    tag: "Thai Specialty",
    tagColor: "bg-green-50 text-green-700 border-green-200",
    desc: "Thai specialty soy sauce with a distinct fermented depth. Particularly popular for its salt-reduced gluten-free black soy sauce.",
  },
  ABC: {
    domain: "abcsambal.com",
    flag: "🇮🇩",
    tag: "Indonesian",
    tagColor: "bg-orange-50 text-orange-700 border-orange-200",
    desc: "Indonesia's leading condiment brand. Best known for kecap manis — thick, sweet soy sauce used in nasi goreng, satay, and Indonesian street food.",
  },
  Kimlan: {
    domain: "kimlan.com",
    flag: "🇹🇼",
    tag: "Taiwanese",
    tagColor: "bg-teal-50 text-teal-700 border-teal-200",
    desc: "Taiwan's premium soy sauce producer. Known for non-GMO soybeans and traditionally fermented recipes passed down for generations.",
  },
  "Wan Ja Shan": {
    domain: "wanjashan.com",
    flag: "🇹🇼",
    tag: "Organic Taiwanese",
    tagColor: "bg-teal-50 text-teal-700 border-teal-200",
    desc: "Specialises in organic, gluten-free tamari and naturally brewed soy sauces. A favourite for health-conscious cooks.",
  },
};

function LogoBadge({ domain, name }: { domain: string; name: string }) {
  return (
    <div className="w-10 h-10 rounded-xl overflow-hidden border border-stone-100 bg-stone-50 flex items-center justify-center flex-shrink-0">
      <Image
        src={`https://logo.clearbit.com/${domain}`}
        alt={name}
        width={40}
        height={40}
        className="object-contain"
        onError={(e) => {
          // Fallback to initials
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

type Props = { activeBrands: string[] };

export default function BrandDirectory({ activeBrands }: Props) {
  const entries = activeBrands
    .map((b) => [b, BRAND_META[b]] as [string, BrandMeta | undefined])
    .filter(([, m]) => m !== undefined) as [string, BrandMeta][];

  if (entries.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6">
      <h2 className="text-base font-semibold text-stone-800 mb-1">Brands</h2>
      <p className="text-xs text-stone-400 mb-5">
        {entries.length} brands · origin and style guide
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {entries.map(([name, meta]) => (
          <div key={name} className="flex gap-3 p-3 rounded-xl border border-stone-100 hover:border-stone-200 transition-colors">
            <LogoBadge domain={meta.domain} name={name} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-sm font-semibold text-stone-800">{name}</span>
                <span className="text-base leading-none">{meta.flag}</span>
              </div>
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border mb-1.5 ${meta.tagColor}`}>
                {meta.tag}
              </span>
              <p className="text-xs text-stone-400 leading-relaxed">{meta.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
