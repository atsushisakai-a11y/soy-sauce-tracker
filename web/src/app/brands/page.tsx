"use client";

import { useState } from "react";
import Image from "next/image";

type Nutrition = {
  energy: string;     // e.g. "325 kJ / 77 kcal"
  fat: string;
  saturates: string;
  carbs: string;
  sugars: string;
  protein: string;
  salt: string;
};

type Product = {
  name: string;
  sizes: string[];
  description: string;
  usage: string;
  ingredients: string;
  nutrition: Nutrition;       // per 100 ml
  nutritionScore: number;     // 1–5 stars
  nutritionNote: string;
  url: string;
};

type Brand = {
  name: string;
  domain: string;
  flag: string;
  website: string;
  catalogueUrl: string;
  tagline: string;
  products: Product[];
};

const BRANDS: Brand[] = [
  {
    name: "Kikkoman",
    domain: "kikkoman.com",
    flag: "🇯🇵",
    website: "https://www.kikkoman.eu/",
    catalogueUrl: "https://www.kikkoman.nl/producten/sojasauzen",
    tagline: "Japan's most iconic naturally-brewed soy sauce since 1917.",
    products: [
      {
        name: "Naturally Brewed Soy Sauce",
        sizes: ["150ml", "250ml", "500ml", "1L", "1.8L"],
        description: "The classic Kikkoman — naturally brewed for 6 months from wheat, soybeans, water and salt. Deep amber colour with a clean, balanced umami taste. Vegan and free from artificial additives.",
        usage: "Universal: dipping, stir-fries, marinades, soups, dressings.",
        ingredients: "Water, soybeans, wheat, salt.",
        nutrition: { energy: "325 kJ / 77 kcal", fat: "0 g", saturates: "0 g", carbs: "3.2 g", sugars: "0.6 g", protein: "10 g", salt: "16.9 g" },
        nutritionScore: 2,
        nutritionNote: "High in salt (per nature of soy sauce). Rich in protein. No fat. Use sparingly.",
        url: "https://www.kikkoman.nl/producten/detail/kikkoman-natuurlijk-gebrouwen-sojasaus",
      },
      {
        name: "Naturally Brewed Less Salt Soy Sauce",
        sizes: ["150ml", "250ml", "500ml", "1L"],
        description: "Same 6-month natural brewing process, but with 43% less salt than regular Kikkoman. Identical depth of flavour — the better everyday choice for health-conscious cooks.",
        usage: "Direct swap for standard soy sauce wherever salt reduction matters.",
        ingredients: "Water, soybeans, wheat, salt.",
        nutrition: { energy: "185 kJ / 44 kcal", fat: "0 g", saturates: "0 g", carbs: "2.5 g", sugars: "0.4 g", protein: "6 g", salt: "9.7 g" },
        nutritionScore: 4,
        nutritionNote: "43% less salt than regular — a noticeably better nutritional profile while keeping full umami.",
        url: "https://www.kikkoman.nl/producten/detail/kikkoman-natuurlijk-gebrouwen-sojasaus-met-minder-zout",
      },
      {
        name: "Tamari Gluten-Free Soy Sauce",
        sizes: ["250ml", "500ml", "1L"],
        description: "Brewed primarily from soybeans with no wheat — making it 100% gluten-free. Richer and slightly thicker than standard shoyu, with a deeper, more complex umami.",
        usage: "Ideal for gluten-free diets. Excellent as a dipping sauce or in cooking.",
        ingredients: "Water, soybeans, salt.",
        nutrition: { energy: "340 kJ / 80 kcal", fat: "0 g", saturates: "0 g", carbs: "4.2 g", sugars: "0.8 g", protein: "11 g", salt: "15.8 g" },
        nutritionScore: 3,
        nutritionNote: "Gluten-free. High protein, high salt. Richer flavour means you may use less.",
        url: "https://www.kikkoman.nl/producten/detail/kikkoman-natuurlijk-gebrouwen-tamari-glutenvrije-sojasaus",
      },
      {
        name: "Sushi & Sashimi Soy Sauce",
        sizes: ["150ml", "250ml"],
        description: "A lighter, more delicate soy sauce crafted specifically for raw fish dishes. Lower salt content lets the natural flavour of sashimi and sushi shine without overpowering.",
        usage: "Dipping sauce for sushi, sashimi, and raw fish preparations.",
        ingredients: "Water, soybeans, wheat, salt, sugar.",
        nutrition: { energy: "175 kJ / 42 kcal", fat: "0 g", saturates: "0 g", carbs: "4.8 g", sugars: "2.1 g", protein: "5.5 g", salt: "10.2 g" },
        nutritionScore: 3,
        nutritionNote: "Lower salt and milder taste profile than standard. Good balance for a dipping sauce.",
        url: "https://www.kikkoman.nl/producten/detail/kikkoman-sushi-sashimi-sojasaus",
      },
      {
        name: "Organic Naturally Brewed Soy Sauce",
        sizes: ["250ml"],
        description: "Same naturally brewed process using certified organic soybeans and wheat. Identical taste profile to the classic — for those who prefer organic ingredients.",
        usage: "Universal use — same as classic but organic certified.",
        ingredients: "Water, organic soybeans, organic wheat, salt.",
        nutrition: { energy: "325 kJ / 77 kcal", fat: "0 g", saturates: "0 g", carbs: "3.2 g", sugars: "0.6 g", protein: "10 g", salt: "16.9 g" },
        nutritionScore: 2,
        nutritionNote: "Organic certified. Same nutritional profile as standard — high salt.",
        url: "https://www.kikkoman.nl/producten/detail/kikkoman-natuurlijk-gebrouwen-biologische-sojasaus",
      },
      {
        name: "Sweet Soy Sauce",
        sizes: ["250ml"],
        description: "A rich, thick blend of naturally brewed soy sauce and sugar. Balanced sweet-savoury taste — a versatile sauce for glazing, marinating and stir-frying.",
        usage: "Glazing meat, drizzling over noodles, stir-fry sauces.",
        ingredients: "Water, sugar, soybeans, wheat, salt, modified starch.",
        nutrition: { energy: "820 kJ / 195 kcal", fat: "0 g", saturates: "0 g", carbs: "44 g", sugars: "38 g", protein: "4.5 g", salt: "10 g" },
        nutritionScore: 2,
        nutritionNote: "High in sugar — use as a flavouring in small quantities. Moderate salt.",
        url: "https://www.kikkoman.nl/producten/detail/kikkoman-zoete-sojasaus",
      },
    ],
  },
  {
    name: "Lee Kum Kee",
    domain: "lkk.com",
    flag: "🇭🇰",
    website: "https://nl.lkk.com/",
    catalogueUrl: "https://nl.lkk.com/producten",
    tagline: "Hong Kong's most recognised sauce brand since 1888.",
    products: [
      {
        name: "Premium Light Soy Sauce",
        sizes: ["150ml", "500ml", "1.75L"],
        description: "LKK's flagship light soy sauce — brewed for a clean, bright umami (\"Xian Wei\") that enhances any dish without darkening it. The go-to choice for Cantonese cooking.",
        usage: "Seasoning, marinades, dipping, stir-fries, dressings. Pairs with all ingredients.",
        ingredients: "Water, soybeans, salt, wheat flour, sugar.",
        nutrition: { energy: "290 kJ / 69 kcal", fat: "0 g", saturates: "0 g", carbs: "5.6 g", sugars: "2.4 g", protein: "8.5 g", salt: "17.5 g" },
        nutritionScore: 2,
        nutritionNote: "Very high in salt. Good protein content. No fat. Use as seasoning rather than sauce.",
        url: "https://nl.lkk.com/producten/premium-lichte-sojasaus",
      },
      {
        name: "Premium Dark Soy Sauce",
        sizes: ["150ml", "500ml"],
        description: "Thicker, richer and less salty than light soy sauce. Adds deep caramel colour and a mild, slightly sweet flavour to dishes. Classic in Chinese red-braised dishes.",
        usage: "Braising, stews, colour enhancement. Add 1–2 tsp at a time to build colour.",
        ingredients: "Water, soybeans, salt, wheat flour, sugar, caramel colour.",
        nutrition: { energy: "380 kJ / 90 kcal", fat: "0 g", saturates: "0 g", carbs: "12 g", sugars: "8 g", protein: "7.2 g", salt: "11.8 g" },
        nutritionScore: 3,
        nutritionNote: "Lower salt than light soy. Higher sugar/carbs. Used in small quantities — good nutritional trade-off.",
        url: "https://nl.lkk.com/producten/premium-donkere-sojasaus",
      },
      {
        name: "Double Deluxe Soy Sauce",
        sizes: ["500ml"],
        description: "LKK's premium aged soy sauce — double-brewed for a fuller, rounder flavour with a longer, more complex finish. Often described as the connoisseur's light soy.",
        usage: "Dipping, cold dishes, high-end cooking where flavour depth matters most.",
        ingredients: "Water, soybeans, salt, wheat flour, sugar.",
        nutrition: { energy: "310 kJ / 74 kcal", fat: "0 g", saturates: "0 g", carbs: "6.8 g", sugars: "3.2 g", protein: "9 g", salt: "16.8 g" },
        nutritionScore: 2,
        nutritionNote: "High salt like all light soy sauces. Richer flavour means you typically use less.",
        url: "https://nl.lkk.com/producten/dubbel-deluxe-sojasaus",
      },
      {
        name: "Seasoned Soy Sauce for Seafood",
        sizes: ["410ml"],
        description: "A lighter, sweeter soy sauce specifically balanced to complement seafood — steamed fish, shellfish and raw preparations. Subtle sweetness and lower salt than standard.",
        usage: "Drizzled over steamed fish or shellfish. Also excellent as a dipping sauce.",
        ingredients: "Water, soybeans, salt, wheat flour, sugar, spices.",
        nutrition: { energy: "230 kJ / 55 kcal", fat: "0 g", saturates: "0 g", carbs: "6.2 g", sugars: "4.1 g", protein: "5.8 g", salt: "12.5 g" },
        nutritionScore: 3,
        nutritionNote: "Lower salt than premium light. Sweetened — use as condiment rather than seasoning.",
        url: "https://nl.lkk.com/producten/gekruide-sojasaus-voor-zeevruchten",
      },
    ],
  },
];

function Stars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`w-4 h-4 ${s <= score ? "text-amber-400" : "text-stone-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-xs text-stone-400">{score}/5</span>
    </div>
  );
}

function NutritionTable({ n }: { n: Nutrition }) {
  const rows = [
    ["Energy", n.energy],
    ["Fat", n.fat],
    ["of which saturates", n.saturates],
    ["Carbohydrates", n.carbs],
    ["of which sugars", n.sugars],
    ["Protein", n.protein],
    ["Salt", n.salt],
  ];
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="border-b border-stone-100">
          <th className="text-left py-1 text-stone-400 font-medium">Per 100ml</th>
          <th className="text-right py-1 text-stone-400 font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, val]) => (
          <tr key={label} className="border-b border-stone-50">
            <td className={`py-1 ${label.startsWith("of") ? "pl-3 text-stone-400" : "text-stone-600"}`}>{label}</td>
            <td className="py-1 text-right text-stone-700 font-medium">{val}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ProductCard({ p }: { p: Product }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-stone-100 rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-stone-50 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-stone-800">{p.name}</span>
            <div className="flex flex-wrap gap-1">
              {p.sizes.map((s) => (
                <span key={s} className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{s}</span>
              ))}
            </div>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed line-clamp-2">{p.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <Stars score={p.nutritionScore} />
          <svg className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Description</h4>
              <p className="text-xs text-stone-600 leading-relaxed">{p.description}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Best Used For</h4>
              <p className="text-xs text-stone-600 leading-relaxed">{p.usage}</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Ingredients</h4>
              <p className="text-xs text-stone-500 leading-relaxed">{p.ingredients}</p>
            </div>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 font-medium"
            >
              View on brand website ↗
            </a>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Nutrition (per 100ml)</h4>
              <NutritionTable n={p.nutrition} />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">Nutrition Score</h4>
              <Stars score={p.nutritionScore} />
              <p className="text-xs text-stone-400 mt-1 leading-relaxed">{p.nutritionNote}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BrandsPage() {
  const [activeBrand, setActiveBrand] = useState(BRANDS[0].name);
  const brand = BRANDS.find((b) => b.name === activeBrand)!;

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-stone-900 mb-1">Brand Guide</h1>
          <p className="text-sm text-stone-400">Soy sauce brands tracked in this project — products, ingredients and nutrition.</p>
        </div>

        {/* Brand tabs */}
        <div className="flex flex-wrap gap-2">
          {BRANDS.map((b) => (
            <button
              key={b.name}
              onClick={() => setActiveBrand(b.name)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                b.name === activeBrand
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-stone-500 border-stone-200 hover:border-amber-300 hover:text-amber-600"
              }`}
            >
              <Image
                src={`https://logo.clearbit.com/${b.domain}`}
                alt={b.name}
                width={18}
                height={18}
                className="rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              {b.name} {b.flag}
            </button>
          ))}
        </div>

        {/* Brand header */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 flex items-start gap-5">
          <div className="w-14 h-14 rounded-xl border border-stone-100 bg-stone-50 flex items-center justify-center flex-shrink-0">
            <Image
              src={`https://logo.clearbit.com/${brand.domain}`}
              alt={brand.name}
              width={48}
              height={48}
              className="object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-stone-900">{brand.name}</h2>
              <span className="text-xl">{brand.flag}</span>
            </div>
            <p className="text-sm text-stone-500 mb-3">{brand.tagline}</p>
            <div className="flex gap-3">
              <a href={brand.website} target="_blank" rel="noopener noreferrer"
                className="text-xs text-amber-600 hover:text-amber-800 font-medium">
                Brand website ↗
              </a>
              <a href={brand.catalogueUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-stone-400 hover:text-stone-600 font-medium">
                Full product catalogue ↗
              </a>
            </div>
          </div>
          <div className="text-xs text-stone-400 text-right flex-shrink-0">
            {brand.products.length} products
          </div>
        </div>

        {/* Products */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-stone-700">Products</h3>
          {brand.products.map((p) => (
            <ProductCard key={p.name} p={p} />
          ))}
        </div>

        <p className="text-xs text-stone-300 text-center">
          Nutrition data sourced from official brand websites · scores reflect relative healthiness within the soy sauce category
        </p>
      </div>
    </main>
  );
}
