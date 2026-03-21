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


def build_preview_html_prompt(code: str, label: str, is_before: bool = False) -> str:
    fidelity_note = """
CRITICAL FIDELITY REQUIREMENTS (this is the BEFORE — the user's actual current UI):
- You MUST faithfully reproduce EXACTLY what this code renders
- Use the EXACT text content, labels, headings, and placeholder values from the code
- Reproduce the EXACT layout structure: same number of columns, rows, sections
- Reproduce the EXACT visual style: same colors, font sizes, border radius, shadows
- Do NOT invent content, do NOT add elements not in the code, do NOT improve anything
- Do NOT hallucinate a generic dashboard — render THIS SPECIFIC component
- If the code maps over an array, show 2-3 realistic items matching the data shape
- If there are conditionals, render the most likely default branch
- This preview must look like a screenshot of the running app""" if is_before else """
This is the AFTER preview (the improved version).
Render this component faithfully to show the improvements."""

    return f"""You are a pixel-perfect frontend engineer creating a STATIC HTML preview of a React component.

## React Component Code
```tsx
{code}
```
{fidelity_note}

## Rendering Rules
1. Convert this React + Tailwind component into self-contained HTML with inline CSS
2. Translate EVERY Tailwind class accurately to its CSS equivalent
3. Preserve the EXACT component hierarchy and nesting structure
4. Keep all text content, labels, and copy EXACTLY as written in the code
5. For dynamic data (props, state, API data), use realistic placeholder values that match the expected data shape
6. Match font sizes, weights, spacing, colors, borders, and shadows precisely
7. Use Inter font family: @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap')
8. The HTML must render correctly in a sandboxed iframe at ~550px width
9. Do NOT add any interactive behavior (no hover effects, no transitions, no JavaScript)
10. Do NOT add any label badge — render ONLY the component itself

Return ONLY the raw HTML — no markdown fences, no explanation.
Start with <!DOCTYPE html>."""
