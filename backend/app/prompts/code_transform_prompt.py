import json


def build_code_analysis_prompt(files_summary: str, focus: str = "") -> str:
    focus_line = f"\nThe user wants to focus on: {focus}" if focus else ""
    return f"""You are a senior frontend architect. Analyze the following codebase and identify its structure.

## Codebase Files
{files_summary}
{focus_line}

## Instructions

Return a JSON object with this exact structure:
{{
  "entry_points": ["list of main page/entry files like page.tsx, index.tsx"],
  "layout_files": ["list of layout/wrapper files"],
  "components": [
    {{
      "name": "ComponentName",
      "file_path": "path/to/file.tsx",
      "type": "page|layout|component|config|style",
      "description": "What this component does in 1 sentence",
      "imports": ["list of local imports this file uses"],
      "exports": ["list of exports from this file"]
    }}
  ],
  "dependency_map": {{
    "path/to/file.tsx": ["path/to/imported_file.tsx", "..."]
  }},
  "recommended_target": "path/to/the/primary/file/to/refactor.tsx",
  "target_reason": "Why this file is the best target for UI improvements"
}}

Rules:
- Only include frontend UI files (TSX, JSX, CSS, Tailwind config)
- Skip node_modules, test files, and non-UI config
- The recommended_target should be the most impactful single file to improve
- Focus on the main visible UI surface (landing page, dashboard, hero section)
- Return ONLY valid JSON — no markdown fences, no explanation"""


def build_code_transform_prompt(
    target_code: str,
    target_path: str,
    supporting_files: str,
    design_intelligence: dict,
    user_intent: str = "",
) -> str:
    intent_line = f"\n## User Intent\n{user_intent}" if user_intent else ""

    recommendations = design_intelligence.get("recommendations", [])
    design_tokens = design_intelligence.get("design_tokens", {})
    global_patterns = design_intelligence.get("global_patterns", {})
    components = design_intelligence.get("components", {})
    avoid = design_intelligence.get("avoid", [])
    competitor_patterns = design_intelligence.get("competitor_patterns", {}) or {}

    competitor_block = ""
    if any(competitor_patterns.get(k) for k in ("layout_patterns", "cta_hierarchy", "spacing_rhythm", "card_style", "typography_tone")):
        competitor_block = (
            "\n### Competitor Constraints (apply 2-4 visibly)\n"
            "These are concrete structural patterns, not inspiration. The output must visibly apply at least 2.\n"
            + json.dumps(competitor_patterns, indent=2)[:1500]
        )

    return f"""You are a senior UI engineer performing an AGGRESSIVE UI transformation.

YOUR #1 GOAL: The before and after must look DRAMATICALLY different.
If a user cannot instantly see the improvement in under 1 second, you have FAILED.

## TARGET FILE: {target_path}
```tsx
{target_code}
```

## SUPPORTING FILES (for context — do NOT modify these)
{supporting_files}

## DESIGN INTELLIGENCE (from competitor analysis)

### Design Tokens
{json.dumps(design_tokens, indent=2)}

### Global Patterns to Apply
{json.dumps(global_patterns, indent=2)}

### Component Patterns
{json.dumps(components, indent=2)}

### Recommendations (ordered by priority)
{json.dumps(recommendations, indent=2)}

### Anti-Patterns to AVOID
{json.dumps(avoid, indent=2)}
{competitor_block}
{intent_line}

---

## TRANSFORMATION PHILOSOPHY

You are NOT polishing. You are REBUILDING the UI.
The logic stays. The UI gets a complete makeover.
Subtle changes are worthless — the user is paying for a visible transformation.

## MANDATORY CHANGES (do ALL of these)

### 1. LAYOUT OVERHAUL (most important)
- Restructure the entire page layout — do NOT preserve the original structure
- If single column → make it multi-column, card grid, or dashboard layout
- Add wrapper cards/panels to group related content
- Introduce clear visual sections with distinct backgrounds
- Use modern patterns: dashboard grids, bento layouts, split panels

### 2. VISUAL HIERARCHY REDESIGN
- Make primary actions 3x more prominent
- Add clear section headings with proper typographic scale
- Create obvious weight differences between primary/secondary/tertiary
- Remove visual noise

### 3. COMPONENT UPGRADES
- Replace basic buttons with properly sized, styled buttons
- Turn flat lists into card grids with padding, borders, hover states
- Upgrade nav elements with active states and clear hierarchy

### 4. SPACING REVOLUTION
- Double the padding inside containers
- Add generous gaps between sections (minimum gap-6)
- The #1 sign of amateur UI is cramped layouts — add breathing room

### 5. VISUAL POLISH
- Apply consistent color system from design tokens
- Add subtle borders to separate sections
- Use background variations for depth
- Consistent rounded corners and shadows

## HANDLING DIFFERENT FRONTEND TYPES

Adapt your strategy to what you're transforming:

- **Image-heavy UIs** (media players, games, creative tools): Focus on OVERLAY components. Make panels larger, higher opacity, stronger glassmorphism. Consolidate scattered controls into unified panels. The image stays — the UI on top of it gets dramatically better.
- **Dashboards**: Reorganize into grid cards, add sidebar, create stat cards with large numbers.
- **Landing pages**: Full-width sections, dramatic hero, prominent CTA, 64px+ section spacing.
- **Forms**: Add grouping, labels, spacing. Split into logical sections.
- **SPAs**: Add navigation structure, clear content areas, breadcrumbs.

## WHAT "DRAMATICALLY DIFFERENT" MEANS

GOOD (visible at a glance):
- Single column → card grid
- Flat page → sectioned dashboard
- Cramped → spacious with clear sections
- Basic form → styled form with proper spacing
- Scattered overlays on image → consolidated glassmorphic panel

BAD (too subtle):
- Only changed colors
- Only adjusted padding slightly
- Layout structure stayed the same

## CONSTRAINTS
- PRESERVE all imports, exports, hooks, state, event handlers, business logic
- DO NOT remove functionality
- DO NOT rename props or state variables
- DO NOT add new npm dependencies
- KEEP component names and file exports
- Return the COMPLETE updated file
- Use Tailwind classes

## LANGUAGE RULES — applies to EVERY narrative field below

`updated_code` holds real code, so class names belong there. Every OTHER field the
user reads — `diff_summary`, `change_annotations[].description`, `change_annotations[].ux_impact`,
`change_summary[]`, `transformation_notes[]` — must be written for a vibe coder who
doesn't want to learn Tailwind to understand what you did.

BANNED vocabulary in all narrative fields (zero exceptions):
- Tailwind / CSS class names: p-6, space-y-6, gap-4, text-sm, text-base, text-xs,
  font-bold, font-medium, divide-y, ml-8, pl-4, grid-cols-2, flex-col, rounded-2xl, etc.
- Spacing token talk: "p-6 card padding", "space-y-6 rhythm", "gap-6 grid", "ml-8/pl-4 misalignment".
- Semantic-HTML / a11y jargon: `role=switch`, `aria-checked`, `aria-label`, `onClick`,
  `divide-y`, `className`, `div`, `span`, the word "Tailwind", px, rem, em, ARIA, element types.
- Code-reviewer voice: "Applied", "Removed conditional", "via X classes", "with identical padding via divide-y".

REWRITE into what the visitor sees:
- Instead of "Applied p-6 card padding and space-y-6 rhythm" → "Sections breathe — consistent padding and spacing throughout."
- Instead of "Removed conditional ml-8/pl-4 misalignment classes" → "Rows line up now — no more staircase effect."
- Instead of "Toggles are now real button elements with role=switch, aria-checked" → "Toggles actually work and keyboard users can flip them."
- Instead of "Typography: text-base font-bold headings, text-sm body, text-xs labels" → "Clear hierarchy — headings are obvious, body is readable, labels fade back."

If you catch yourself naming a class or an attribute in a narrative field, rewrite
the sentence from scratch focusing on what the user notices, not the HTML.

## OUTPUT FORMAT

Return a JSON object with this exact structure:
{{
  "updated_code": "the complete transformed file content",
  "diff_summary": "1 sentence a non-coder can read — what the user sees differently. NO class names.",
  "change_annotations": [
    {{
      "region": "section name",
      "change_type": "flow|layout|spacing|component|visual",
      "description": "What the user notices — NOT the HTML or CSS that got it there. NO class names, NO ARIA attributes, NO semantic-HTML jargon.",
      "ux_impact": "Why it's better for the user, in a sentence. Speak to the outcome, not the mechanism."
    }}
  ],
  "change_summary": [
    "Short visible improvement — what the visitor would say if they reloaded and noticed. NO class names."
  ],
  "transformation_notes": [
    "1-4 short bullets. Each one names a competitor and the vibe you borrowed.",
    "Talk like a designer to a friend, not like a code reviewer.",
    "Good: 'Borrowed Linear's calm stat-card vibe — big numbers, tiny labels.'",
    "Bad: 'Applied p-6 padding with space-y-6 vertical gap per linear.app pattern.'"
  ]
}}

Return ONLY valid JSON — no markdown fences, no explanation."""
