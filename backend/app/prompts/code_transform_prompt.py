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

    return f"""You are a senior React + Tailwind engineer performing a SAFE UI refactor.

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
{intent_line}

---

## TRANSFORMATION RULES (CRITICAL — follow in this exact order)

### Step 1: Layout
- Improve structure, grouping, and visual hierarchy
- Apply layout patterns from design intelligence
- Do NOT change component tree structure unless necessary

### Step 2: Spacing
- Improve padding, margins, gap values
- Apply spacing scale from design tokens
- Ensure consistent density

### Step 3: Components
- Improve buttons, cards, nav elements, form controls
- Apply component patterns from design intelligence
- Keep all props and event handlers intact

### Step 4: Visual Polish
- Apply colors, borders, shadows, typography from design tokens
- Use Tailwind classes (prefer utilities over arbitrary values)
- Apply motion/transition patterns

## STRICT CONSTRAINTS
- This is a REFACTOR, NOT a rewrite
- PRESERVE all imports, exports, hooks, state, event handlers, and business logic
- DO NOT remove any functionality
- DO NOT rename props or state variables
- DO NOT add new dependencies or imports that don't exist
- DO NOT change file structure
- KEEP the same component names
- Return the COMPLETE updated file — not a partial snippet
- Prefer Tailwind classes over inline styles

## OUTPUT FORMAT

Return a JSON object with this exact structure:
{{
  "updated_code": "the complete refactored file content",
  "diff_summary": "1 sentence, plain English, no code terms. Example: 'Improved page layout and visual consistency'",
  "change_annotations": [
    {{
      "region": "human-readable section name like 'Hero section', 'Navigation bar', 'Page layout' — NOT code terms like 'body element' or 'div container'",
      "change_type": "layout|spacing|component|visual",
      "description": "Plain English description a designer would write. NO code terms, NO class names, NO HTML tags. BAD: 'Added min-h-screen Tailwind utility to body className'. GOOD: 'Made the page fill the full screen height'",
      "ux_impact": "User-facing benefit in plain English. BAD: 'Improves developer experience'. GOOD: 'Eliminates white gaps on short pages'"
    }}
  ],
  "change_summary": [
    "Plain English improvement a non-developer would understand. NO backticks, NO code terms, NO class names, NO HTML tags. BAD: 'Added min-h-screen to the body element'. GOOD: 'Pages now fill the full screen height, preventing blank gaps at the bottom'"
  ]
}}

CRITICAL LANGUAGE RULES for change_annotations, change_summary, and diff_summary:
- Write as if explaining to a product manager or designer, NOT a developer
- NEVER use: className, div, span, Tailwind, CSS, px, rem, hex, tag, element, utility, component name
- NEVER use backticks or code formatting
- Focus on WHAT THE USER SEES, not what the code does
- Use words like: section, area, button, heading, spacing, alignment, contrast, visibility

Return ONLY valid JSON — no markdown fences, no explanation."""
