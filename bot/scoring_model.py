"""
scoring_model.py — Propensity-to-buy model for European soy sauce leads.

Architecture
------------
1. Feature extraction  : Groq LLM reads the full conversation and returns
                         structured scores (1-5) for five dimensions.
2. Weighted scoring    : A weighted average is normalised to 0-100.
3. Explainability      : Each dimension has a one-sentence reason, plus an
                         overall summary — important for portfolio presentation.

Dimensions & weights
--------------------
soy_engagement    (30%)  Passion & knowledge about soy sauce
cooking_frequency (25%)  Actively cooks dishes that need soy sauce
brand_awareness   (20%)  Knows brands, has preferences
market_sentiment  (15%)  Optimistic about European soy sauce market growth
cultural_affinity (10%)  Background with soy sauce culinary tradition

Score interpretation
--------------------
80-100  High propensity   — likely buyer, strong market interest
60-79   Medium-high       — engaged, likely occasional buyer
40-59   Medium            — curious, potential future buyer
20-39   Low-medium        — limited engagement
0-19    Low               — unlikely buyer

Usage
-----
    from scoring_model import score_conversation
    result = score_conversation(history, groq_api_key)
    print(result.propensity_score)   # e.g. 72.5
    print(result.summary)
"""

import json
import logging
from dataclasses import dataclass, field

from groq import Groq

logger = logging.getLogger(__name__)

GROQ_MODEL = "llama-3.3-70b-versatile"

WEIGHTS: dict[str, float] = {
    "soy_engagement":    0.30,
    "cooking_frequency": 0.25,
    "brand_awareness":   0.20,
    "market_sentiment":  0.15,
    "cultural_affinity": 0.10,
}

SCORE_LABELS = {
    (80, 100): "🔥 High propensity",
    (60,  79): "✅ Medium-high",
    (40,  59): "🟡 Medium",
    (20,  39): "🔵 Low-medium",
    (0,   19): "⬜ Low",
}


@dataclass
class DimensionScore:
    score: int    # 1-5
    reason: str


@dataclass
class ScoringResult:
    propensity_score: float                          # 0-100
    label: str                                       # e.g. "✅ Medium-high"
    fav_brand: str
    dishes: str
    origin_country: str
    market_outlook: str
    breakdown: dict[str, DimensionScore] = field(default_factory=dict)
    summary: str = ""

    def breakdown_json(self) -> str:
        """Serialise breakdown to JSON string for BigQuery storage."""
        return json.dumps({
            dim: {"score": v.score, "reason": v.reason}
            for dim, v in self.breakdown.items()
        })


def _label(score: float) -> str:
    for (lo, hi), label in SCORE_LABELS.items():
        if lo <= score <= hi:
            return label
    return "Unknown"


def score_conversation(history: list[dict], api_key: str) -> ScoringResult:
    """Extract features from conversation history and return a ScoringResult.

    Parameters
    ----------
    history : list of {role, text} dicts (user + assistant turns)
    api_key : Groq API key
    """
    client = Groq(api_key=api_key)

    # Build readable conversation text (user turns only for analysis)
    user_turns = [t["text"] for t in history if t["role"] == "user"]
    conv_text = "\n".join(f"User message {i+1}: {msg}" for i, msg in enumerate(user_turns))

    if not conv_text.strip():
        conv_text = "No conversation recorded."

    extraction_prompt = f"""You are an analyst scoring a lead's propensity to buy soy sauce \
in Europe based on a chatbot conversation.

CONVERSATION (user messages):
{conv_text}

Return ONLY a JSON object — no markdown, no explanation outside the JSON:
{{
  "fav_brand": "<user's favourite soy sauce brand, or 'Not mentioned'>",
  "dishes": "<dishes user mentioned cooking with soy sauce, or 'Not mentioned'>",
  "origin_country": "<user's country/region of origin, or 'Not mentioned'>",
  "market_outlook": "<user's view on European soy sauce market growth, or 'Not mentioned'>",
  "scores": {{
    "soy_engagement":    {{"score": <1-5>, "reason": "<one sentence>"}},
    "cooking_frequency": {{"score": <1-5>, "reason": "<one sentence>"}},
    "brand_awareness":   {{"score": <1-5>, "reason": "<one sentence>"}},
    "market_sentiment":  {{"score": <1-5>, "reason": "<one sentence>"}},
    "cultural_affinity": {{"score": <1-5>, "reason": "<one sentence>"}}
  }},
  "summary": "<one sentence overall assessment of this lead's likelihood to buy soy sauce>"
}}

Scoring guide (1 = very low, 5 = very high):
- soy_engagement:    How passionate / knowledgeable is the user about soy sauce?
- cooking_frequency: How actively does the user cook dishes requiring soy sauce?
- brand_awareness:   Does the user know specific soy sauce brands and have preferences?
- market_sentiment:  Is the user optimistic about European soy sauce market growth?
- cultural_affinity: Does the user's background suggest familiarity with soy sauce cuisine?

If information is missing for a dimension, score it 2 (below average — unknown = uncertain)."""

    def _call_groq(prompt: str) -> str:
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=700,
            temperature=0.1,
        )
        return resp.choices[0].message.content.strip()

    def _extract_json(text: str) -> dict:
        """Strip prose/fences, repair, and parse the first {...} block found.

        Uses json-repair to fix common LLM JSON issues (missing commas,
        unescaped quotes inside strings, trailing commas, etc.).
        """
        from json_repair import repair_json  # pip install json-repair

        # Remove markdown code fences
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()
        # Extract from first { to last } to discard any surrounding prose
        start = text.find("{")
        end   = text.rfind("}") + 1
        if start == -1 or end == 0:
            raise ValueError(f"No JSON object found in response: {text[:200]}")
        blob = text[start:end]
        # Try strict parse first; fall back to repair
        try:
            return json.loads(blob)
        except json.JSONDecodeError as exc:
            logger.warning("Strict JSON parse failed (%s) — applying json-repair", exc)
            logger.debug("Raw blob: %s", blob[:500])
            repaired = repair_json(blob, return_objects=True)
            if isinstance(repaired, dict):
                return repaired
            raise ValueError(f"json-repair returned unexpected type {type(repaired)}: {repaired}")

    raw = _call_groq(extraction_prompt)
    data = _extract_json(raw)

    # ── Weighted score ────────────────────────────────────────────────────────
    scores = data["scores"]
    raw_score = sum(
        WEIGHTS[dim] * scores[dim]["score"]
        for dim in WEIGHTS
    )
    # Normalise [1, 5] → [0, 100]
    propensity_score = round((raw_score - 1) / 4 * 100, 1)

    breakdown = {
        dim: DimensionScore(score=scores[dim]["score"], reason=scores[dim]["reason"])
        for dim in WEIGHTS
    }

    result = ScoringResult(
        propensity_score=propensity_score,
        label=_label(propensity_score),
        fav_brand=data.get("fav_brand", "Not mentioned"),
        dishes=data.get("dishes", "Not mentioned"),
        origin_country=data.get("origin_country", "Not mentioned"),
        market_outlook=data.get("market_outlook", "Not mentioned"),
        breakdown=breakdown,
        summary=data.get("summary", ""),
    )

    logger.info(
        "Scoring complete — score=%.1f (%s) | brand=%s | country=%s",
        result.propensity_score, result.label,
        result.fav_brand, result.origin_country,
    )
    return result


# ── CLI helper ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    load_dotenv()

    # Demo with a sample conversation
    sample_history = [
        {"role": "user", "text": "I'm really into Japanese cooking and use Kikkoman all the time."},
        {"role": "assistant", "text": "Kikkoman is a classic! What dishes do you usually make?"},
        {"role": "user", "text": "Mostly stir-fries, ramen, and teriyaki. I'm originally from the Netherlands but my partner is Japanese."},
        {"role": "assistant", "text": "What a great combination! Do you think soy sauce will become more popular in Europe?"},
        {"role": "user", "text": "Definitely — Asian food is exploding here. I buy soy sauce almost every week."},
    ]

    result = score_conversation(sample_history, os.environ["GROQ_API_KEY"])

    print(f"\n{'='*50}")
    print(f"  PROPENSITY SCORE: {result.propensity_score} / 100  {result.label}")
    print(f"{'='*50}")
    print(f"  Favourite brand : {result.fav_brand}")
    print(f"  Dishes          : {result.dishes}")
    print(f"  Origin          : {result.origin_country}")
    print(f"  Market outlook  : {result.market_outlook}")
    print(f"\n  Score breakdown:")
    for dim, s in result.breakdown.items():
        bar = "█" * s.score + "░" * (5 - s.score)
        print(f"    {dim:<20} [{bar}] {s.score}/5  {s.reason}")
    print(f"\n  Summary: {result.summary}")
    print(f"{'='*50}\n")
