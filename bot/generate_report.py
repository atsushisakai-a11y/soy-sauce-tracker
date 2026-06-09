"""
generate_report.py — Generate the exclusive European Soy Sauce Market Report PDF.

Usage:
    python3 generate_report.py
    Outputs: european_soy_sauce_market_report.pdf
"""

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ── Colours ───────────────────────────────────────────────────────────────────
AMBER   = colors.HexColor("#b45309")
STONE   = colors.HexColor("#292524")
MUTED   = colors.HexColor("#78716c")
BG_ROW  = colors.HexColor("#fef3c7")
WHITE   = colors.white

OUTPUT  = Path(__file__).parent / "european_soy_sauce_market_report.pdf"
MONTH   = date.today().strftime("%B %Y")

# ── Page template ─────────────────────────────────────────────────────────────
def build_doc() -> BaseDocTemplate:
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin,
        doc.width, doc.height,
        id="main",
    )

    def header_footer(canvas, doc):
        canvas.saveState()
        # Header bar
        canvas.setFillColor(AMBER)
        canvas.rect(0, A4[1] - 14 * mm, A4[0], 14 * mm, fill=1, stroke=0)
        canvas.setFillColor(WHITE)
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawString(20 * mm, A4[1] - 9 * mm, "🫙  European Soy Sauce Market Report")
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(A4[0] - 20 * mm, A4[1] - 9 * mm, MONTH)
        # Footer
        canvas.setFillColor(MUTED)
        canvas.setFont("Helvetica", 7)
        canvas.drawString(20 * mm, 10 * mm,
            "Data source: soy-sauce-tracker-s3eo.vercel.app  ·  Prices scraped from European online shops")
        canvas.drawRightString(A4[0] - 20 * mm, 10 * mm,
            f"Page {doc.page}  ·  Exclusive report — not for redistribution")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
    return doc


# ── Styles ────────────────────────────────────────────────────────────────────
styles = getSampleStyleSheet()

title_style = ParagraphStyle("title",
    fontName="Helvetica-Bold", fontSize=22, textColor=STONE,
    spaceAfter=2 * mm, leading=26)

subtitle_style = ParagraphStyle("subtitle",
    fontName="Helvetica", fontSize=11, textColor=MUTED,
    spaceAfter=6 * mm, leading=15)

h2_style = ParagraphStyle("h2",
    fontName="Helvetica-Bold", fontSize=13, textColor=AMBER,
    spaceBefore=5 * mm, spaceAfter=2 * mm)

body_style = ParagraphStyle("body",
    fontName="Helvetica", fontSize=9, textColor=STONE,
    leading=13, spaceAfter=2 * mm)

small_style = ParagraphStyle("small",
    fontName="Helvetica", fontSize=8, textColor=MUTED,
    leading=11, spaceAfter=1 * mm)


# ── Content ───────────────────────────────────────────────────────────────────
def build_story():
    story = []
    W = 170 * mm  # usable width

    # ── Title block ──────────────────────────────────────────────────────────
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("European Soy Sauce", title_style))
    story.append(Paragraph("Market Report", title_style))
    story.append(Paragraph(
        f"Exclusive edition · {MONTH} · Netherlands focus",
        subtitle_style))
    story.append(HRFlowable(width=W, color=AMBER, thickness=1.5, spaceAfter=5 * mm))

    # ── Key stats ────────────────────────────────────────────────────────────
    story.append(Paragraph("Market Snapshot", h2_style))

    stat_data = [
        ["Metric", "Value"],
        ["Average market price (June 2026)", "€4.72"],
        ["Cheapest product available", "€0.99"],
        ["Most expensive product", "€21.60"],
        ["Unique products tracked", "115"],
        ["Brands covered", "12"],
        ["Online shops monitored", "6"],
        ["Data quality (dbt tests passing)", "42 / 42 ✓"],
    ]
    stat_table = Table(stat_data, colWidths=[W * 0.72, W * 0.28])
    stat_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0),  AMBER),
        ("TEXTCOLOR",   (0, 0), (-1, 0),  WHITE),
        ("FONTNAME",    (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, 0),  9),
        ("FONTNAME",    (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",    (0, 1), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, BG_ROW]),
        ("ALIGN",       (1, 0), (1, -1),  "CENTER"),
        ("FONTNAME",    (1, 1), (1, -1),  "Helvetica-Bold"),
        ("TEXTCOLOR",   (1, 1), (1, -1),  AMBER),
        ("GRID",        (0, 0), (-1, -1), 0.3, colors.HexColor("#e7e5e4")),
        ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(stat_table)
    story.append(Spacer(1, 4 * mm))

    # ── Shop comparison ──────────────────────────────────────────────────────
    story.append(Paragraph("Shop Price Comparison", h2_style))
    story.append(Paragraph(
        "All shops are Netherlands-based online retailers. Prices include VAT.",
        small_style))

    shop_data = [
        ["Shop", "Avg Price", "Products", "Range", "Profile"],
        ["Tjin's Toko",  "€4.44", "39", "€1.40 – €14.60", "Best selection"],
        ["ACE Market",   "€4.67", "12", "€1.89 – €9.99",  "Best value"],
        ["Dun Yong",     "€5.80", "17", "€1.50 – €21.60", "Est. 1969, Amsterdam"],
        ["Shilla Market","€6.09",  "8", "€4.20 – €9.60",  "Japanese premium"],
        ["Toko Asia",      "—",   "—",  "—",              "Data collected"],
        ["Toko Gembira",   "—",   "—",  "—",              "Data collected"],
    ]
    shop_table = Table(shop_data, colWidths=[W*0.24, W*0.12, W*0.12, W*0.24, W*0.28])
    shop_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0),  AMBER),
        ("TEXTCOLOR",   (0, 0), (-1, 0),  WHITE),
        ("FONTNAME",    (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, -1), 8),
        ("FONTNAME",    (0, 1), (-1, -1), "Helvetica"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, BG_ROW]),
        ("ALIGN",       (1, 0), (2, -1),  "CENTER"),
        ("GRID",        (0, 0), (-1, -1), 0.3, colors.HexColor("#e7e5e4")),
        ("TOPPADDING",  (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(shop_table)
    story.append(Spacer(1, 4 * mm))

    # ── Brands ───────────────────────────────────────────────────────────────
    story.append(Paragraph("Brands Tracked", h2_style))

    brand_data = [
        ["Brand", "Origin", "Notable products"],
        ["Kikkoman",          "Japan 🇯🇵",       "Naturally Brewed, Less Salt, Tamari GF, Organic"],
        ["Lee Kum Kee",       "Hong Kong 🇭🇰",   "Classic, Premium, Seasoned"],
        ["Pearl River Bridge","China 🇨🇳",        "Golden Label, Superior"],
        ["Yamasa",            "Japan 🇯🇵",       "Standard, Organic"],
        ["Marukin",           "Japan 🇯🇵",       "Traditional varieties"],
        ["Sempio",            "South Korea 🇰🇷", "701, 999 grades"],
        ["Takesan",           "Japan 🇯🇵",       "Kishibori Shouyu (premium, €21.60)"],
        ["Mee Chun",          "Hong Kong 🇭🇰",   "Light, Dark soy sauce"],
        ["Healthy Boy",       "Thailand 🇹🇭",    "Mushroom soy sauce"],
        ["Dek Som Boon",      "Thailand 🇹🇭",    "Sweet soy varieties"],
        ["Silver Swan",       "Philippines 🇵🇭", "Standard soy sauce"],
        ["ABC",               "Indonesia 🇮🇩",   "Kecap manis"],
    ]
    brand_table = Table(brand_data, colWidths=[W*0.28, W*0.22, W*0.50])
    brand_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, 0),  AMBER),
        ("TEXTCOLOR",   (0, 0), (-1, 0),  WHITE),
        ("FONTNAME",    (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, -1), 8),
        ("FONTNAME",    (0, 1), (-1, -1), "Helvetica"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, BG_ROW]),
        ("GRID",        (0, 0), (-1, -1), 0.3, colors.HexColor("#e7e5e4")),
        ("TOPPADDING",  (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(brand_table)
    story.append(Spacer(1, 4 * mm))

    # ── Bottle sizes ─────────────────────────────────────────────────────────
    story.append(Paragraph("Bottle Sizes Monitored", h2_style))
    story.append(Paragraph(
        "132ml · 150ml · 200ml · 207ml · 250ml · 275ml · 300ml · 385ml · "
        "410ml · 500ml · 600ml · 700ml · 720ml · 975ml · 1,000ml",
        body_style))

    # ── Key insight ──────────────────────────────────────────────────────────
    story.append(HRFlowable(width=W, color=AMBER, thickness=0.5, spaceBefore=4*mm, spaceAfter=4*mm))
    story.append(Paragraph("Key Insight", h2_style))
    story.append(Paragraph(
        "Tjin's Toko offers the broadest selection (39 products, 10+ brands) at a "
        "below-average price of €4.44. ACE Market is the most competitive on price "
        "for a smaller range. Premium Japanese specialty sauces (Takesan Kishibori "
        "Shouyu at €21.60) command a 20× premium over budget options (€0.99). "
        "Budget-conscious shoppers should compare 500ml formats where price-per-litre "
        "differences across shops can exceed 40%.",
        body_style))

    # ── CTA ──────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 3 * mm))
    cta_data = [["Track live prices: soy-sauce-tracker-s3eo.vercel.app  ·  Sign up via @soy_sauce_tracker_bot on Telegram"]]
    cta_table = Table(cta_data, colWidths=[W])
    cta_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), BG_ROW),
        ("TEXTCOLOR",     (0, 0), (-1, -1), AMBER),
        ("FONTNAME",      (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 8),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BOX",           (0, 0), (-1, -1), 1, AMBER),
    ]))
    story.append(cta_table)

    return story


# ── Build ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    doc = build_doc()
    doc.build(build_story())
    print(f"✅  Report saved to: {OUTPUT}")
