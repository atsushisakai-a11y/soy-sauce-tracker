"use client";

import { useState } from "react";
import Image from "next/image";

type Nutrition = {
  energy: string;
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
  nutrition: Nutrition;
  nutritionScore: number;
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
  {
    name: "Yamasa",
    domain: "yamasa.com",
    flag: "🇯🇵",
    website: "https://www.yamasa.com/",
    catalogueUrl: "https://www.yamasa.com/products/shoyu/",
    tagline: "One of Japan's oldest soy sauce brewers, founded in 1645.",
    products: [
      {
        name: "Yamasa Soy Sauce (Naturally Brewed)",
        sizes: ["150ml", "500ml", "1L", "1.8L"],
        description: "Yamasa's flagship koikuchi shoyu — naturally brewed using the same process refined over nearly 380 years. Deep amber colour with a full-bodied, rounded umami and a clean finish.",
        usage: "Universal: dipping, cooking, marinades, stir-fries, soups. The classic Japanese all-rounder.",
        ingredients: "Water, soybeans, wheat, salt.",
        nutrition: { energy: "310 kJ / 74 kcal", fat: "0 g", saturates: "0 g", carbs: "5.0 g", sugars: "2.0 g", protein: "9.2 g", salt: "16.0 g" },
        nutritionScore: 2,
        nutritionNote: "High salt typical of naturally brewed koikuchi. Good protein content. No fat.",
        url: "https://www.yamasa.com/products/shoyu/",
      },
      {
        name: "Yamasa Marudaizu Shoyu (Whole Soybean)",
        sizes: ["500ml", "1L"],
        description: "Brewed exclusively from whole (non-defatted) soybeans, which results in a richer, more complex flavour with a deeper body and a distinctly sweeter finish compared to regular shoyu.",
        usage: "Ideal for dipping sauces, sashimi, cold tofu, or anywhere you want the soy sauce to be a focal flavour.",
        ingredients: "Water, whole soybeans, wheat, salt.",
        nutrition: { energy: "335 kJ / 80 kcal", fat: "0.3 g", saturates: "0 g", carbs: "5.5 g", sugars: "2.5 g", protein: "10.0 g", salt: "15.5 g" },
        nutritionScore: 3,
        nutritionNote: "Slightly higher in natural fat from whole soybeans. Richer flavour means you typically use less.",
        url: "https://www.yamasa.com/products/shoyu/",
      },
      {
        name: "Yamasa Less Salt Soy Sauce",
        sizes: ["150ml", "500ml"],
        description: "Naturally brewed then salt-reduced — roughly 50% less sodium than standard Yamasa. Retains the characteristic Yamasa umami profile in a lighter, more health-conscious format.",
        usage: "Direct substitute for regular soy sauce. Particularly good for daily cooking where salt intake is a concern.",
        ingredients: "Water, soybeans, wheat, salt.",
        nutrition: { energy: "180 kJ / 43 kcal", fat: "0 g", saturates: "0 g", carbs: "3.5 g", sugars: "1.5 g", protein: "6.5 g", salt: "8.5 g" },
        nutritionScore: 4,
        nutritionNote: "~50% less salt than standard — one of the best nutritional profiles in the shoyu category.",
        url: "https://www.yamasa.com/products/shoyu/",
      },
    ],
  },
  {
    name: "Marukin",
    domain: "marukin.co.jp",
    flag: "🇯🇵",
    website: "https://moritakk.com/",
    catalogueUrl: "https://moritakk.com/products/syouyu/",
    tagline: "Specialty Japanese soy sauce brewer under Moritakk, known for white and specialty shoyu.",
    products: [
      {
        name: "Koikuchi Shoyu (Dark Soy Sauce)",
        sizes: ["500ml", "1L"],
        description: "Marukin's classic all-purpose dark soy sauce. Naturally brewed from soybeans and wheat with a well-balanced umami, mild sweetness and deep amber colour. A solid everyday Japanese shoyu.",
        usage: "All-purpose seasoning, stir-fries, marinades, dipping sauces, ramen and miso soup base.",
        ingredients: "Water, soybeans, wheat, salt.",
        nutrition: { energy: "315 kJ / 75 kcal", fat: "0 g", saturates: "0 g", carbs: "4.8 g", sugars: "1.8 g", protein: "9.0 g", salt: "16.2 g" },
        nutritionScore: 2,
        nutritionNote: "Standard koikuchi nutritional profile. High salt, good protein, no fat.",
        url: "https://moritakk.com/products/syouyu/",
      },
      {
        name: "Low Salt Soy Sauce",
        sizes: ["1L"],
        description: "Marukin's health-oriented soy sauce with significantly reduced sodium. Maintains a clean shoyu taste that makes it a practical everyday alternative for salt-conscious households.",
        usage: "Direct substitute for regular soy sauce in all cooking applications. Excellent for daily family cooking.",
        ingredients: "Water, soybeans, wheat, salt.",
        nutrition: { energy: "200 kJ / 48 kcal", fat: "0 g", saturates: "0 g", carbs: "3.8 g", sugars: "1.4 g", protein: "7.0 g", salt: "9.0 g" },
        nutritionScore: 4,
        nutritionNote: "Substantially lower salt. Good everyday option for health-conscious shoppers.",
        url: "https://moritakk.com/products/syouyu/",
      },
      {
        name: "Usukuchi Shoyu (Light Soy Sauce)",
        sizes: ["500ml"],
        description: "A lighter-coloured soy sauce that preserves the natural colour and flavour of ingredients. Counterintuitively, usukuchi contains slightly more salt than koikuchi — it's lighter in colour, not in seasoning.",
        usage: "Japanese soups (suimono), delicate simmered dishes, and anywhere the deep colour of koikuchi would be unwanted.",
        ingredients: "Water, soybeans, wheat, salt, mirin.",
        nutrition: { energy: "290 kJ / 69 kcal", fat: "0 g", saturates: "0 g", carbs: "4.2 g", sugars: "2.0 g", protein: "7.5 g", salt: "18.0 g" },
        nutritionScore: 2,
        nutritionNote: "Slightly higher salt than koikuchi — typically used in smaller quantities for delicate dishes.",
        url: "https://moritakk.com/products/syouyu/",
      },
      {
        name: "Shiro Shoyu (White Soy Sauce)",
        sizes: ["200ml", "500ml"],
        description: "Japan's most unique soy sauce — pale golden in colour, made primarily from wheat with only a small proportion of soybeans. Delicate, subtly sweet flavour that adds umami without colouring the dish at all.",
        usage: "Japanese haute cuisine (kaiseki), clear soups, chawanmushi (egg custard), and any dish where colour must be preserved.",
        ingredients: "Water, wheat, soybeans, salt.",
        nutrition: { energy: "265 kJ / 63 kcal", fat: "0 g", saturates: "0 g", carbs: "9.5 g", sugars: "5.0 g", protein: "3.5 g", salt: "17.5 g" },
        nutritionScore: 2,
        nutritionNote: "Highest in carbs/sugars among shoyu types. Very high salt. Used in tiny quantities as a flavouring.",
        url: "https://moritakk.com/products/syouyu/shiroshoyu",
      },
    ],
  },
  {
    name: "Sempio",
    domain: "sempio.com",
    flag: "🇰🇷",
    website: "https://en.sempio.com/",
    catalogueUrl: "https://en.sempio.com/product/soysauce",
    tagline: "Korea's No. 1 soy sauce brand for over 70 years.",
    products: [
      {
        name: "Soy Sauce Jin S",
        sizes: ["500ml", "1.7L"],
        description: "Sempio's best-selling soy sauce in Europe. Jin S (진간장) is a blend of naturally brewed and chemically produced soy sauce — giving it a rich, deep flavour at an accessible price. The go-to for Korean home cooking.",
        usage: "Seasoning rice dishes, soups, stews, bulgogi marinades, and general Korean cooking.",
        ingredients: "Water, soybean, wheat, salt, sugar, alcohol.",
        nutrition: { energy: "290 kJ / 69 kcal", fat: "0 g", saturates: "0 g", carbs: "7.5 g", sugars: "4.0 g", protein: "7.0 g", salt: "16.5 g" },
        nutritionScore: 2,
        nutritionNote: "High salt. Moderate sugars. Standard profile for a Korean blended soy sauce.",
        url: "https://en.sempio.com/product/soysauce/view/595",
      },
      {
        name: "Naturally Brewed Soy Sauce 501",
        sizes: ["500ml"],
        description: "Sempio's flagship naturally brewed soy sauce — fermented for at least 6 months using traditional Korean methods. Higher total nitrogen (TN) content means deeper, more complex umami compared to Jin S.",
        usage: "Premium seasoning, dipping, cold dishes, and dishes where naturally brewed flavour is preferred.",
        ingredients: "Water, soybean, wheat, salt.",
        nutrition: { energy: "300 kJ / 71 kcal", fat: "0 g", saturates: "0 g", carbs: "4.5 g", sugars: "1.5 g", protein: "8.5 g", salt: "16.2 g" },
        nutritionScore: 3,
        nutritionNote: "Naturally brewed — lower sugar than Jin S, higher protein. Better nutritional profile.",
        url: "https://en.sempio.com/product/soysauce/view/597",
      },
      {
        name: "Soy Sauce Gluten-Free",
        sizes: ["500ml"],
        description: "Sempio's gluten-free soy sauce — brewed without wheat, making it suitable for coeliac and gluten-intolerant consumers. Rich umami flavour comparable to their standard naturally brewed range.",
        usage: "All-purpose — any recipe that calls for soy sauce, safe for gluten-free diets.",
        ingredients: "Water, soybean, salt, sugar.",
        nutrition: { energy: "280 kJ / 67 kcal", fat: "0 g", saturates: "0 g", carbs: "5.0 g", sugars: "2.0 g", protein: "8.8 g", salt: "16.0 g" },
        nutritionScore: 3,
        nutritionNote: "Gluten-free. No wheat. Good protein content. High salt as expected.",
        url: "https://en.sempio.com/product/soysauce/view/601",
      },
      {
        name: "Naturally Brewed Soy Sauce, Organic",
        sizes: ["500ml"],
        description: "Certified organic, naturally brewed over 6+ months. Made with organically grown soybeans and wheat — for consumers who want both the depth of naturally brewed shoyu and organic certification.",
        usage: "Premium cooking and dipping. Ideal for health-conscious shoppers.",
        ingredients: "Water, organic soybean, organic wheat, salt.",
        nutrition: { energy: "295 kJ / 70 kcal", fat: "0 g", saturates: "0 g", carbs: "4.2 g", sugars: "1.2 g", protein: "9.0 g", salt: "16.0 g" },
        nutritionScore: 3,
        nutritionNote: "Organic certified. Clean ingredients. High protein, no additives.",
        url: "https://en.sempio.com/product/soysauce/view/1059",
      },
    ],
  },
  {
    name: "Takesan",
    domain: "takesan.co.jp",
    flag: "🇯🇵",
    website: "https://takesan.co.jp/",
    catalogueUrl: "https://takesan.co.jp/item/#section-01",
    tagline: "Artisan soy sauce hand-crafted in century-old cedar barrels on Shodoshima island.",
    products: [
      {
        name: "Kishibori Shoyu — Pure Artisan Soy Sauce",
        sizes: ["250ml", "720ml"],
        description: "Takesan's signature product — aged for 1 full year in 100-year-old cedar barrels on the island of Shodoshima, Kagawa. Unpasteurised (nama) and unfiltered. The result is a soy sauce of extraordinary complexity: rich, round, slightly sweet, with a long finish unlike any mass-produced brand.",
        usage: "Best used raw — as a dipping sauce for sashimi, over tofu, as a finishing drizzle. Avoid cooking at high heat which destroys the delicate aromas.",
        ingredients: "Water, soybeans, wheat, salt. (No additives, unpasteurised.)",
        nutrition: { energy: "340 kJ / 81 kcal", fat: "0 g", saturates: "0 g", carbs: "5.8 g", sugars: "3.2 g", protein: "9.5 g", salt: "16.0 g" },
        nutritionScore: 3,
        nutritionNote: "Unpasteurised — retains natural enzymes and active cultures. Richer flavour means you use less. High salt typical of shoyu.",
        url: "https://takesan.co.jp/item/#section-01",
      },
      {
        name: "Tokusen Kishibori Shoyu — Premium Reserve",
        sizes: ["250ml"],
        description: "Takesan's top-tier expression — selected barrels aged even longer. A deeper, more concentrated version of Kishibori Shoyu with an almost wine-like complexity. Limited availability; often sold as a gift item.",
        usage: "Collector's soy sauce — best reserved for cold dipping, fine sashimi, or as a condiment. A gift for any serious Japanese food enthusiast.",
        ingredients: "Water, soybeans, wheat, salt. (No additives, unpasteurised, barrel-selected.)",
        nutrition: { energy: "360 kJ / 86 kcal", fat: "0 g", saturates: "0 g", carbs: "6.5 g", sugars: "3.8 g", protein: "10.0 g", salt: "16.2 g" },
        nutritionScore: 3,
        nutritionNote: "Same clean ingredients as standard Kishibori — the difference is craft and aging, not nutrition.",
        url: "https://takesan.co.jp/item/#section-01",
      },
    ],
  },
  {
    name: "Pearl River Bridge",
    domain: "pearlriverbridge.com",
    flag: "🇨🇳",
    website: "https://www.pearlriverbridge.com/",
    catalogueUrl: "https://www.pearlriverbridge.com/regular-soy-sauce",
    tagline: "Guangdong's most exported soy sauce brand — affordable, versatile, widely stocked.",
    products: [
      {
        name: "Superior Light Soy Sauce",
        sizes: ["150ml", "500ml", "600ml", "1.75L"],
        description: "PRB's flagship light soy sauce — thin, bright amber colour with a clean, salty-savoury taste. The most widely sold Chinese soy sauce in European Asian supermarkets. Versatile and affordable.",
        usage: "Seasoning, stir-fries, marinades, dipping, fried rice. Use wherever a Chinese light soy sauce is required.",
        ingredients: "Water, soybeans, wheat flour, salt, sugar.",
        nutrition: { energy: "260 kJ / 62 kcal", fat: "0 g", saturates: "0 g", carbs: "5.8 g", sugars: "2.5 g", protein: "7.8 g", salt: "18.0 g" },
        nutritionScore: 2,
        nutritionNote: "Very high salt. Standard affordable Chinese light soy — use as seasoning in small amounts.",
        url: "https://www.pearlriverbridge.com/prb-superior-light-soy-sauce",
      },
      {
        name: "Golden Label Superior Light Soy Sauce",
        sizes: ["500ml"],
        description: "PRB's premium tier — slower-brewed with a higher soybean-to-water ratio. Noticeably richer and more complex than the standard Superior Light. The gold label signals premium grade within the PRB lineup.",
        usage: "Dipping, cold dishes, and recipes where a finer Chinese soy sauce flavour is desired.",
        ingredients: "Water, soybeans, wheat flour, salt, sugar.",
        nutrition: { energy: "285 kJ / 68 kcal", fat: "0 g", saturates: "0 g", carbs: "6.2 g", sugars: "2.8 g", protein: "9.0 g", salt: "17.5 g" },
        nutritionScore: 2,
        nutritionNote: "Higher protein than standard — better soybean ratio. Still high salt.",
        url: "https://www.pearlriverbridge.com/prb-superior-light-soy-sauce",
      },
      {
        name: "Superior Dark Soy Sauce",
        sizes: ["150ml", "500ml"],
        description: "PRB's dark soy sauce — thick, almost syrupy, deep mahogany colour. Much less salty than light soy; adds caramel colour and a mild sweet-savoury depth to braised dishes and sauces.",
        usage: "Red-braised pork, char siu, stews, noodles. Add 1 tsp at a time to build colour.",
        ingredients: "Water, soybeans, wheat flour, salt, sugar, caramel colour.",
        nutrition: { energy: "370 kJ / 88 kcal", fat: "0 g", saturates: "0 g", carbs: "14.0 g", sugars: "9.0 g", protein: "6.5 g", salt: "11.0 g" },
        nutritionScore: 3,
        nutritionNote: "Lower salt than light soy. Higher carbs from molasses/caramel. Used in very small quantities.",
        url: "https://www.pearlriverbridge.com/regular-soy-sauce",
      },
      {
        name: "Mushroom Dark Soy Sauce",
        sizes: ["150ml", "500ml"],
        description: "Dark soy sauce infused with mushroom extract — adds depth of colour AND a subtle earthy umami from the mushrooms. Popular in vegetarian and vegan Chinese cooking.",
        usage: "Braising, vegetarian stir-fries, noodle sauces. A great way to add both colour and umami without meat.",
        ingredients: "Water, soybeans, wheat flour, salt, sugar, mushroom extract, caramel colour.",
        nutrition: { energy: "355 kJ / 85 kcal", fat: "0 g", saturates: "0 g", carbs: "13.0 g", sugars: "8.5 g", protein: "6.8 g", salt: "11.5 g" },
        nutritionScore: 3,
        nutritionNote: "Same profile as dark soy with added mushroom umami. Good vegan flavour booster.",
        url: "https://www.pearlriverbridge.com/regular-soy-sauce",
      },
    ],
  },
];

function Stars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`w-4 h-4 ${s <= score ? "text-amber-400" : "text-stone-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-xs text-stone-400">{score}/5</span>
    </div>
  );
}

function NutritionTable({ n }: { n: Nutrition }) {
  const rows: [string, string][] = [
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
            <a href={p.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 font-medium">
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

export default function BrandsSection() {
  const [activeBrand, setActiveBrand] = useState(BRANDS[0].name);
  const brand = BRANDS.find((b) => b.name === activeBrand)!;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-stone-900 mb-1">Brand Guide</h2>
        <p className="text-sm text-stone-400">Products, ingredients and nutrition for every brand tracked in this project.</p>
      </div>

      {/* Brand picker */}
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
            <h3 className="text-lg font-bold text-stone-900">{brand.name}</h3>
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
    </section>
  );
}
