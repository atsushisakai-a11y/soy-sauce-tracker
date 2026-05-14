"""
find_shops.py
Queries OpenStreetMap (via Overpass API) for Asian shops in Amsterdam.
Outputs: scraper/output/amsterdam_asian_shops.csv

No API key required.
"""

import csv
import json
import logging
import os
import sys
import time

import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
TIMEOUT = 30

# Overpass QL query:
# Finds nodes/ways in Amsterdam tagged as supermarkets or shops
# with cuisine, name, or shop tags suggesting Asian origin
QUERY = """
[out:json][timeout:60];
area["name"="Amsterdam"]["boundary"="administrative"]["admin_level"="8"]->.amsterdam;
(
  node["shop"="supermarket"](area.amsterdam);
  node["shop"="convenience"](area.amsterdam);
  node["shop"="grocery"](area.amsterdam);
  node["shop"="deli"](area.amsterdam);
  node["cuisine"~"asian|japanese|chinese|korean|thai|vietnamese|indonesian|sushi",i](area.amsterdam);
  node["name"~"asia|toko|oriental|japan|china|korea|thai|viet|indo|nikan|shilla|yong",i](area.amsterdam);
  way["shop"="supermarket"](area.amsterdam);
  way["name"~"asia|toko|oriental|japan|china|korea|thai|viet|indo|nikan|shilla|yong",i](area.amsterdam);
);
out body;
>;
out skel qt;
"""


def fetch_shops() -> list[dict]:
    log.info("Querying OpenStreetMap Overpass API …")
    try:
        r = requests.post(
            OVERPASS_URL,
            data={"data": QUERY},
            headers={"Accept": "application/json"},
            timeout=TIMEOUT,
        )
        r.raise_for_status()
    except requests.RequestException as e:
        log.error("Overpass API request failed: %s", e)
        return []

    elements = r.json().get("elements", [])
    log.info("Raw elements returned: %d", len(elements))

    shops = []
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name", "").strip()
        if not name:
            continue

        # Filter: keep only shops that look Asian by name or cuisine
        name_lower = name.lower()
        cuisine = tags.get("cuisine", "").lower()
        asian_keywords = [
            "asia", "toko", "oriental", "japan", "china", "korean", "thai",
            "viet", "indo", "nikan", "shilla", "yong", "sushi", "ramen",
            "wok", "hing", "ming", "sing", "wing", "hong", "ping",
        ]
        asian_cuisines = [
            "asian", "japanese", "chinese", "korean", "thai",
            "vietnamese", "indonesian", "sushi",
        ]
        is_asian = (
            any(kw in name_lower for kw in asian_keywords)
            or any(c in cuisine for c in asian_cuisines)
        )
        if not is_asian:
            continue

        website = (
            tags.get("website")
            or tags.get("url")
            or tags.get("contact:website")
            or ""
        )
        phone = tags.get("phone") or tags.get("contact:phone") or ""
        street = tags.get("addr:street", "")
        housenumber = tags.get("addr:housenumber", "")
        address = f"{street} {housenumber}".strip()

        shops.append({
            "name": name,
            "address": address,
            "website": website,
            "phone": phone,
            "cuisine": cuisine,
            "shop_type": tags.get("shop", ""),
            "osm_id": el.get("id", ""),
            "osm_type": el.get("type", ""),
        })

    # Deduplicate by name + address
    seen = set()
    unique = []
    for s in shops:
        key = (s["name"].lower(), s["address"].lower())
        if key not in seen:
            seen.add(key)
            unique.append(s)

    unique.sort(key=lambda x: x["name"].lower())
    return unique


def save_csv(shops: list[dict]) -> str:
    os.makedirs("output", exist_ok=True)
    path = "output/amsterdam_asian_shops.csv"
    fieldnames = ["name", "address", "website", "phone", "cuisine", "shop_type", "osm_id", "osm_type"]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(shops)
    log.info("Saved %d shops → %s", len(shops), path)
    return path


if __name__ == "__main__":
    shops = fetch_shops()
    if shops:
        save_csv(shops)
        print(f"\nFound {len(shops)} Asian shops in Amsterdam:\n")
        for s in shops:
            website_display = s["website"] if s["website"] else "(no website in OSM)"
            print(f"  {s['name']:<35} {s['address']:<30} {website_display}")
    else:
        log.error("No shops found — check the Overpass query or your internet connection.")
        sys.exit(1)
