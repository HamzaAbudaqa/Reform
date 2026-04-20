"""
Transformation prompt — REBUILD mode.

Philosophy: structural rebuild, visual inheritance. The model rebuilds the
JSX tree from scratch (new wrappers, new grouping, new hierarchy), but
inherits the original's visual identity (colors, type feel, radii, shadows,
spacing primitives). Same product, a better-structured version of itself —
not a redesign, not a re-brand.
"""

import json


# ── Score-driven rebuild playbook ─────────────────────────────────────
# Each weak dimension maps to concrete structural moves the model can
# actually execute. Replaces the generic "rebuild this dimension aggressively"
# directive that was producing templated, non-targeted output.
_DIMENSION_MOVES = {
    "layout_structure": (
        "Introduce semantic wrappers (header / main / section / aside) the original is missing. "
        "Regroup content into clearly-bounded card panels. Break single-column stacks into grids "
        "where content is parallel."
    ),
    "visual_hierarchy": (
        "Promote exactly one primary heading per section. Demote secondary actions to text or "
        "ghost buttons. Establish real size contrast — titles 2-3× the body text, not 1.1×."
    ),
    "spacing_consistency": (
        "Pick ONE section gap, ONE card padding, ONE grid gap — and use them everywhere. "
        "Kill arbitrary margins. Rhythm over density."
    ),
    "cta_clarity": (
        "Exactly one dominant CTA per view — prominent placement, solid color, larger size. "
        "Every other action demoted. No CTA competition."
    ),
    "component_quality": (
        "Upgrade primitive containers: stats become card grids with big numbers and small "
        "uppercase labels; lists become bordered cards with divide-y rows; forms become "
        "grouped sections with clear field spacing."
    ),
    "information_density": (
        "Decompress. Every element gets room to breathe. Break dense regions into distinct "
        "sections. If a region feels cramped at first glance, it is — add space."
    ),
}


def _compute_weakest_dimensions(breakdown: dict) -> list[tuple[str, int]]:
    """Return dimensions sorted by score ascending."""
    if not breakdown:
        return []
    items = [(k, v) for k, v in breakdown.items() if isinstance(v, (int, float))]
    items.sort(key=lambda x: x[1])
    return items


def build_transform_system_prompt() -> str:
    """
    System prompt: rebuild structure, inherit visual identity.

    The model should rebuild the JSX tree from scratch while keeping the
    original's colors, typography, radii, shadows, and spacing primitives.
    The result is the same product, better organized — not a redesign.
    """
    return """You are a UI rebuild engine. You rebuild the STRUCTURE of a page from scratch while keeping the original's brand colors.

CORE PRINCIPLE — two layers, one rebuilt, one preserved:

1. STRUCTURE — REBUILD from scratch. This is the job.
   The JSX tree, element hierarchy, grouping, section boundaries, wrapper elements, nesting depth, grid vs. stack decisions, hero treatment, where things sit on the page. Discard the original layout and build a new one. A reviewer scrolling before/after side-by-side should immediately see two different pages, not the same page with tighter margins or nicer padding.

2. BRAND — KEEP the colors, type family, and radius style.
   The color palette (which hues mean primary / muted / surface), the font family, the corner rounding vocabulary (`rounded-lg` / `rounded-2xl` / whatever the file already uses). Do not swap indigo for rose, do not change from sans to serif, do not turn sharp corners into pills.

Everything else is fair game — AND SHOULD CHANGE. Specifically:
- Typography SIZES can and should change. A bigger hero headline (text-5xl / text-6xl / text-7xl) is a structural improvement, not a brand change.
- Spacing scale can change. If the original is cramped, use generous gaps; if it's sparse, tighten consistently.
- New wrappers, new grids, new card containers, new split layouts, new stats rails — add them.
- Shadow density, border weights, surface elevation — adjust them to match the new hierarchy.

DO NOT CONFUSE "keep the brand" WITH "leave structure alone". Keeping indigo does not mean leaving the `<div><div><div>` skeleton untouched. Keeping `rounded-2xl` does not mean keeping the same six stacked cards in the same order.

PICK AN ARCHETYPE BEFORE YOU WRITE ANY JSX. Every rebuild should visibly belong to one of these canonical modern layouts (or a named variant of one):
- Bento — unequal-sized cards in an asymmetric grid, with a hero tile.
- Dashboard — sticky top nav, left rail, main content grid, right-side summary panel.
- Split — 50/50 or 60/40 two-column with an aside that carries context / CTA / meta.
- Landing-modular — hero band → three-up feature grid → bordered-card list → closing CTA band. Each band has its own max-width container and clear boundaries.
- Sidebar-content — persistent left nav, everything else lives in a single content column with section headers.
- Stats-first — a KPI rail at the top (3-4 big-number cards) then a content grid below.

State the archetype you picked in `transformation_notes`. If the original is already one of these, pick a DIFFERENT one — the whole point of a rebuild is the archetype changes.

MINIMUM BAR FOR A VALID REBUILD (every rebuild must hit all of these):
- At least 2 wrapper or section elements exist in the output that did NOT exist in the input (`<header>`, `<main>`, `<section>`, `<aside>`, card/grid `<div>`s, etc).
- The top-level child ordering of the main content region is visibly rearranged — not the original order with different spacing.
- At least one formerly single-column region becomes a grid, OR one formerly flat list becomes grouped bordered cards, OR one formerly cramped region becomes multiple sections with clear boundaries.
- At least one element dramatically scales up (hero heading 2-3× bigger than before, primary CTA visibly larger, key stat displayed at display-size text).
- The JSX tag sequence, read top-to-bottom, is fundamentally different. If you can diff the two files and see the first 10+ opening tags in the same order as the original, the rebuild is a polish not a rebuild — throw it out and rebuild harder.

A rebuild that only changes `className` strings and leaves the tag skeleton intact WILL be rejected — the validator measures tag-sequence churn and ships the attempt back for another try. Lead with structural change; cosmetic polish is the tail of the work, not the head of it.

REBUILD PROCESS:
1. Read the original and extract three things:
   (a) logic — imports, exports, hooks, state, props, types, handlers
   (b) content — headings, labels, copy, dynamic data expressions
   (c) visual tokens actually used — color classes (`bg-slate-900`, `text-indigo-600`), radii (`rounded-2xl`), shadows (`shadow-lg`), type weights, theme (dark/light)
2. Discard the original JSX layout entirely.
3. Rebuild a new JSX tree from scratch — new wrappers, new grouping, new hierarchy, new section boundaries.
4. When styling the new layout, REUSE the visual tokens from step 1(c). Inherit the brand. Do not invent a new palette.

WHAT A REBUILD LOOKS LIKE:
- The JSX tag sequence is fundamentally different — new wrappers, new nesting depth, new children arrangement.
- New semantic elements that did not exist before (header / main / section / aside wrappers, card containers).
- Content regrouped into bounded panels with clear boundaries.
- Different flow — single-column stacks become grids, loose lists become bordered cards with divide-y rows.
- Same data, same handlers, same colors — rearranged structure.

HARD CONSTRAINTS (never violate):
- Preserve every import, export, hook call, state declaration, handler, prop, and type. Logic is untouched.
- Same component name. Same default export.
- No new npm dependencies. Use only imports that already exist in the file.
- Use Tailwind CSS classes. Prefer the ones the original already uses for color, type, radius, and shadow.
- Return the COMPLETE rebuilt file, not a snippet or a diff.

SYNTAX SAFETY — the output must parse as TypeScript/JSX on the first try:
- Every opening tag has a matching closing tag. Self-closing tags end with `/>`.
- Every `{` inside JSX has a matching `}`. Count them before returning.
- No Python syntax leaking in: no `True` / `False` / `None`, no f-strings, no `def`, no tuples as JSX children.
- Do not break destructuring, spread, or template literals you did not intend to change.
- If you cannot confidently rebuild a fragment without breaking its JSX, leave that fragment structurally intact and rebuild around it.

OUTPUT: Return ONLY valid JSON, no markdown fences."""


def build_structural_transform_prompt(
    target_code: str,
    target_path: str,
    supporting_files: str,
    evaluation: dict,
    design_intelligence: dict,
    user_intent: str = "",
    is_retry: bool = False,
    attempt_number: int = 1,
    ux_lab_findings: list[dict] | None = None,
    previous_syntax_error: str = "",
) -> str:
    """User-message prompt with score-driven rebuild instructions."""
    score = evaluation.get("score", 50)
    issues = evaluation.get("issues", [])
    reasoning = evaluation.get("reasoning", "")
    breakdown = evaluation.get("breakdown", {})

    # Score-driven: each weak dimension gets a concrete rebuild move
    # instead of a generic "rebuild aggressively" directive.
    weakest = _compute_weakest_dimensions(breakdown)
    weak_dims = [(n, s) for n, s in weakest if s < 95]

    weak_section = ""
    if weak_dims:
        lines = []
        for name, sc in weak_dims[:4]:
            label = name.replace("_", " ").title()
            move = _DIMENSION_MOVES.get(name, "Rebuild this dimension.")
            lines.append(f"- {label} ({sc}/100)\n  {move}")
        weak_section = "PRIORITY MOVES (target the weakest dimensions first):\n" + "\n".join(lines)

    issues_text = ""
    if issues:
        issue_lines = [
            f"- [{i.get('severity','medium').upper()}] {i.get('area','')}: {i.get('description','')}"
            for i in issues[:6]
        ]
        issues_text = "ISSUES TO FIX:\n" + "\n".join(issue_lines)

    # Design intelligence — framed as "use these tokens", not "here's a dump".
    di = design_intelligence or {}
    di_text = ""
    if di.get("design_tokens") or di.get("recommendations"):
        di_parts = []
        if di.get("design_tokens"):
            di_parts.append(
                "Design tokens — USE THESE for colors, typography, radii, and shadows. "
                "Do not invent a new palette:\n"
                + json.dumps(di["design_tokens"], indent=2)[:1500]
            )
        if di.get("recommendations"):
            di_parts.append(
                "Structural recommendations to apply:\n"
                + json.dumps(di["recommendations"])[:500]
            )
        di_text = "\n\n".join(di_parts)

    # Structured competitor constraints — these are HARD requirements, not
    # vague "inspiration". The rebuild must visibly apply the strongest
    # 2-4 patterns and name them in `transformation_notes`.
    cp = di.get("competitor_patterns") or {}
    competitor_block = ""
    if cp and any(cp.get(k) for k in ("layout_patterns", "cta_hierarchy", "spacing_rhythm", "card_style", "typography_tone")):
        lines = []
        if cp.get("layout_patterns"):
            pats = cp["layout_patterns"] if isinstance(cp["layout_patterns"], list) else [cp["layout_patterns"]]
            lines.append("LAYOUT PATTERNS (pick the 1-2 most applicable and make them visible):")
            for p in pats[:4]:
                lines.append(f"  - {p}")
        if cp.get("cta_hierarchy"):
            lines.append(f"CTA HIERARCHY: {cp['cta_hierarchy']}")
        if cp.get("spacing_rhythm"):
            lines.append(f"SPACING RHYTHM: {cp['spacing_rhythm']}")
        if cp.get("card_style"):
            lines.append(f"CARD STYLE: {cp['card_style']}")
        if cp.get("typography_tone"):
            lines.append(f"TYPOGRAPHY TONE: {cp['typography_tone']}")
        sources = cp.get("source_competitors") or []
        if sources:
            lines.append(
                "SOURCE COMPETITORS (reference these by domain in transformation_notes): "
                + ", ".join(sources[:6])
            )
        competitor_block = (
            "## COMPETITOR CONSTRAINTS — apply 2-4 of these visibly in the rebuild\n"
            "These are concrete structural patterns extracted from competitor sites. "
            "They are not 'inspiration' — the rebuilt page must visibly adopt them. "
            "You MUST reference at least 2 of these in the `transformation_notes` field of your output, "
            "naming the competitor by domain where possible.\n\n"
            + "\n".join(lines)
        )

    intent_line = f"\nUSER INTENT: {user_intent}" if user_intent else ""

    ux_findings_text = ""
    if ux_lab_findings:
        lines = []
        for f in ux_lab_findings:
            severity = f.get("severity", "major").upper()
            component = f.get("component", "")
            title = f.get("title", "")
            recommendation = f.get("recommendation", "")
            lines.append(f"- [{severity}] {component} — \"{title}\"\n  Fix: {recommendation}")
        ux_findings_text = (
            "## UX LAB FINDINGS — MUST FIX\n"
            "These issues were identified by UX analysis. Each one must be visibly addressed "
            "in the rebuild.\n\n"
            + "\n\n".join(lines)
        )

    # Retry block — factual and specific. No "REJECTED" theatrics. The goal
    # is a more careful next attempt, not a more frantic one.
    retry_block = ""
    if is_retry:
        if previous_syntax_error:
            retry_block = f"""
ATTEMPT {attempt_number}. The previous attempt failed to parse as TypeScript/JSX:

    {previous_syntax_error}

This is a .tsx file. Common causes: unclosed tag, unbalanced `{{` / `}}`, a stray `:` or `,` where
JSX expects a child, mismatched quotes, or Python literals leaking in (`True`/`False`/`None`).
Fix the specific error above, keep the rebuild quality high, and re-balance braces and tags
before returning.
"""
        else:
            # Retries are capped at 2 total (so attempts 1, 2, 3). Any
            # retry means the last attempt failed the "structural" bar —
            # the right move is to escalate hard immediately rather than
            # do another gentle nudge and waste the budget.
            retry_block = f"""
ATTEMPT {attempt_number}. YOUR PREVIOUS ATTEMPT FAILED VALIDATION — the rebuild was too timid
and got rejected as "basically the same layout with different class names". Stop polishing
the original. Start from a blank page.

Do this instead of whatever you did last time:
- BEFORE writing any JSX, pick an archetype from the system prompt's list (bento,
  dashboard, split, landing-modular, sidebar-content, stats-first) that is DIFFERENT from
  whatever the original resembles. State it in transformation_notes.
- Write a one-paragraph layout plan: "Section order will be A, B, C. A will be a bento
  hero with one big tile and three small ones. B will be a three-up feature grid inside
  a bordered panel. C will be a stats rail followed by a two-column split." Then build
  to that plan — do not mirror the original's flow.
- Delete at least 50% of the original's wrapper `<div>`s and replace them with semantic
  elements (`<header>`, `<main>`, `<section>`, `<aside>`, `<article>`).
- Change the dominant layout direction somewhere: a single column becomes a grid, a
  horizontal stack becomes vertical, or vice versa.
- Make at least one element dramatically larger than the original — a huge hero
  heading, a display-size KPI number, a full-width CTA band. Visual weight is part of
  structure, not polish.
- The result should be unambiguously a different page structure. If it looks "similar
  but cleaner", that's still a fail — similar is what gets rejected.

Keep the same colors, fonts, radii, handlers, imports, and data. Change everything else.
"""

    return f"""{retry_block}Rebuild this page. Current score: {score}/100.

{weak_section}

{issues_text}

{ux_findings_text}

Evaluation reasoning: {reasoning}
{intent_line}

## ORIGINAL CODE — extract logic, content, and visual tokens, then rebuild the structure
File: {target_path}
```tsx
{target_code}
```

## SUPPORTING FILES (read-only context)
{supporting_files}

{f"## DESIGN INTELLIGENCE{chr(10)}{di_text}" if di_text else ""}

{competitor_block}

## REBUILD CHECKLIST

Archetype — pick one BEFORE writing JSX
- bento / dashboard / split / landing-modular / sidebar-content / stats-first (see system prompt for definitions).
- Pick one DIFFERENT from whatever archetype the original resembles. A rebuild that stays inside the same archetype family is a polish, not a rebuild.
- Name the chosen archetype in `transformation_notes`.

Layout
- New top-level wrapper structure. Prefer semantic elements (header, main, section, aside).
- Add a max-width container if the original lacks one.
- Group related content into bounded card panels with consistent borders and padding.
- If the original is single-column, break parallel content into a grid. If it's flat cards, promote one to hero-size in a bento. If it's dense, introduce breathing bands.
- Change the dominant layout direction of AT LEAST ONE region: vertical stack → horizontal grid, or flat row → stacked cards, or grid → split.

Hierarchy & size
- Exactly one primary heading per section. Demote the rest.
- Exactly one dominant CTA per view. Other actions become text or ghost buttons.
- Real typographic contrast — titles visibly larger and heavier than body text.
- At least ONE display-size element: hero headline `text-5xl` / `text-6xl` / `text-7xl`, or a KPI number rendered large, or a full-width CTA band. Visual weight is a structural choice — use it.

Spacing rhythm
- Pick one section gap (e.g., `space-y-12`, `space-y-16`, `space-y-20`) and use it throughout. Bias toward generous — cramped layouts are a leading cause of "looks the same" feedback.
- Pick one card padding (`p-6`, `p-8`, `p-10`) and use it throughout.
- Pick one grid / list gap (`gap-4`, `gap-6`, `gap-8`) and use it throughout.
- No arbitrary margins. Rhythm over density.

Components
- Stats / KPIs → card grid with large numbers and small uppercase labels.
- Lists → card-bounded with divide-y rows and proper padding.
- Forms → grouped into labeled sections with space between fields.
- Buttons → consistent sizing, obvious hover states.

Brand — KEEP, don't re-invent (but don't confuse this with "change nothing")
- Keep the color palette family (indigo stays indigo, rose stays rose, dark theme stays dark).
- Keep the border-radius vocabulary the original uses.
- Keep the font family and general weight scale.
- Do not swap Tailwind color families. Do not introduce a new accent hue.
- Type SIZES, spacing scale, shadow density, and surface elevation ARE fair game — changing those is part of the rebuild, not part of the brand.

Logic — PRESERVE exactly
- Every import stays. Every export stays. Every hook call stays.
- Every handler stays bound to the same action it handled in the original.
- Every JSX expression that references dynamic data — `{{variable}}`, `{{fn()}}`, `{{list.map(...)}}` — appears somewhere in the rebuilt tree.
- Component name and default export are unchanged.

## LANGUAGE RULES — applies to EVERY narrative field below

The `updated_code` field contains real code, so class names belong there.
Every OTHER field the user reads — `diff_summary`, `change_annotations[].description`,
`change_annotations[].ux_impact`, `change_summary[]`, `transformation_notes[]` — must
be written for a vibe coder who doesn't want to learn Tailwind to understand what you did.

BANNED vocabulary in all narrative fields (zero exceptions):
- Tailwind / CSS class names: p-6, space-y-6, gap-4, text-sm, text-base, text-xs,
  font-bold, font-medium, divide-y, ml-8, pl-4, grid-cols-2, flex-col, rounded-2xl, etc.
- Spacing tokens: "p-6 card padding", "space-y-6 rhythm", "gap-6 grid", "ml-8/pl-4 misalignment".
- Semantic-HTML / a11y jargon: `role=switch`, `aria-checked`, `aria-label`, `onClick`, `divide-y`,
  `className`, `div`, `span`, the word "Tailwind", px, rem, em, ARIA, element types.
- Code-reviewer voice: "Applied", "Removed conditional", "via X classes", "with identical padding via divide-y".

REWRITE into what the visitor sees:
- Instead of "Applied p-6 card padding and space-y-6 rhythm" → "Sections breathe — consistent padding and spacing throughout."
- Instead of "Removed conditional ml-8/pl-4 misalignment classes" → "Rows line up now — no more staircase effect."
- Instead of "Toggles are now real button elements with role=switch, aria-checked" → "Toggles actually work and keyboard users can flip them."
- Instead of "Typography: text-base font-bold headings, text-sm body, text-xs labels" → "Clear hierarchy — headings are obvious, body is readable, labels fade back."

If you catch yourself naming a class or an attribute in a narrative field, rewrite
the sentence from scratch focusing on what the user notices, not the HTML.

## OUTPUT FORMAT

Return ONLY this JSON, no markdown fences:
{{
  "updated_code": "the COMPLETE rebuilt file",
  "diff_summary": "1 sentence a non-coder can read — what the user sees differently. NO class names.",
  "change_annotations": [
    {{
      "region": "section name",
      "change_type": "layout|hierarchy|spacing|cta|component|clutter",
      "description": "what changed visually — describe what the user notices, NOT the HTML or CSS that got it there. NO class names, NO ARIA attributes, NO semantic-HTML jargon.",
      "ux_impact": "why it's better for the user, in a sentence. Speak to the outcome, not the mechanism."
    }}
  ],
  "change_summary": ["Short visible improvement — what the visitor would say if they reloaded and noticed. NO class names."],
  "transformation_notes": [
    "1-4 short bullets. Each one names a competitor and the vibe you borrowed.",
    "Talk like a designer to a friend, not like a code reviewer.",
    "Good: 'Borrowed Linear's calm stat-card vibe — big numbers, tiny labels, lots of breathing room.'",
    "Good: 'Took Vercel's one-bold-button rule so the main action actually pops.'",
    "Good: 'Stole Stripe's two-step delete flow — destructive actions now ask for confirmation.'",
    "Bad: 'Applied p-6 padding and space-y-6 vertical gap matching linear.app section rhythm.'"
  ]
}}"""
