"""Claude vision prompt for extracting design signal from a Google Stitch design.

Stitch designs are single-screen AI-generated UI mockups. The extraction
goal is: given one screenshot, emit structured design tokens + patterns
that slot into Reform's DesignIntelligence pipeline alongside (or in
place of) competitor-derived signal.
"""

SYSTEM_PROMPT = """You are a senior product designer reverse-engineering a single UI mockup into a structured design spec. You output strict JSON — no prose, no markdown, no comments.""".strip()


USER_PROMPT_TEMPLATE = """Analyze this UI mockup from Google Stitch and extract its design language as STRICT JSON.

Your output is consumed programmatically. It will be merged into a design-intelligence blob that drives production code transforms, so be specific and structural — not aesthetic adjectives, but concrete moves another engineer could reproduce.

## Required JSON shape

```json
{{
  "summary": "One sentence describing the design in structural terms. Example: 'Dense analytics dashboard with left rail nav, stat grid, and a dominant chart card.'",
  "design_tokens": {{
    "theme": "light" | "dark" | "",
    "palette": {{
      "background": "#RRGGBB",
      "surface": "#RRGGBB",
      "primary": "#RRGGBB",
      "text": "#RRGGBB",
      "muted": "#RRGGBB",
      "accent": "#RRGGBB"
    }},
    "typography_tone": "One sentence. Be specific: weight emphasis, tracking, display vs body scale. Example: 'Tight tracking, large 48px display, small-caps eyebrows, body 14px.'",
    "spacing_rhythm": "One sentence. Be numeric where possible. Example: 'Generous 80-96px between sections, 16px inner padding, 24px gap between cards.'",
    "border_radius": "Dominant corner radius. Example: '12px', '8px', 'sharp (no radius)'."
  }},
  "patterns": {{
    "layout_patterns": [
      "Short concrete layout description (max 6)."
    ],
    "cta_hierarchy": "One sentence on primary/secondary/tertiary CTA treatment. Example: 'Solid primary button top-right, ghost secondaries inline, no tertiary.'",
    "spacing_rhythm": "Same as design_tokens.spacing_rhythm but phrased as a reusable rule.",
    "card_style": "One sentence. Example: 'Flat cards, 1px border, 12px radius, no shadow.'",
    "typography_tone": "Same as design_tokens.typography_tone phrased as a rule.",
    "component_patterns": [
      "Component-level observation (max 6). Example: 'Sidebar collapses to icon rail on narrow widths', 'Primary nav uses pill-shaped active state'."
    ]
  }}
}}
```

## Rules

1. Output ONLY the JSON object. No prose before or after. No markdown fences.
2. Every string field must be present. Use "" for fields you can't extract, [] for lists.
3. Colors must be `#RRGGBB` hex. If the design is dark, the palette must reflect that.
4. `layout_patterns` should contain 2-5 items. `component_patterns` 2-6. Skip if genuinely not visible.
5. Do NOT invent values that aren't supported by the image. An empty list beats a fabricated one.
6. Optional context (product goal, target user) — incorporate if meaningful, otherwise ignore:
{context}
"""


def build_extraction_prompt(context: str = "") -> str:
    """Build the user-message prompt text. `context` is optional free-text
    about the project that helps Claude prioritize what matters. Callers
    pass the style goal or product description when available."""
    ctx = context.strip() if context else "(no additional context)"
    return USER_PROMPT_TEMPLATE.format(context=ctx)
