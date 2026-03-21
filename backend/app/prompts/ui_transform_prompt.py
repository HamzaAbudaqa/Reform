import json


def build_code_generation_prompt(
    intelligence: dict,
    refined_ui: dict,
    tailwind_tokens: dict,
) -> str:
    return f"""You are a senior React engineer. Generate production-quality React + Tailwind code for a developer tool called RefineUI.

## Design Intelligence (source of truth)
{json.dumps(intelligence, indent=2)}

## Refined UI Structure (already processed — follow exactly)
{json.dumps(refined_ui, indent=2)}

## Tailwind Token Map (use these classes — no other colors)
{json.dumps(tailwind_tokens, indent=2)}

---

## Requirements

Generate ONE complete file with all components. Follow these rules strictly:

### Layout
- Three-panel workspace: left sidebar (navigation), center canvas (visual output), right panel (controls)
- The workspace fills the full viewport height
- Use flex or CSS grid — no random positioning

### Components to generate (in order)
1. `Button` — accepts `variant` prop ("primary" | "secondary"), applies correct classes
2. `Card` — accepts `className` prop, wraps children with rounded-xl + border + padding
3. `Navbar` — logo left, minimal nav links center, CTA button right
4. `Sidebar` — left panel, dark background, vertical navigation items with active state
5. `MainCanvas` — center panel, shows before/after output area with a loading state skeleton
6. `ControlPanel` — right panel, grouped toggle switches + dropdown selectors + sliders
7. `WorkspaceLayout` — three-panel container that composes Sidebar + MainCanvas + ControlPanel
8. `App` — root component: Navbar on top, WorkspaceLayout below

### Design rules (enforce all)
- Dark theme only: use the exact hex colors from the token map as Tailwind arbitrary values
- No gradients, no glassmorphism, no random colors outside the token map
- Cards: rounded-xl, 1px border, p-4 or p-6
- Primary button: accent background, white text, rounded-md
- Secondary button: dark muted background, secondary text color, rounded-md
- Consistent spacing: gap-4 or gap-6 between panels, p-4 or p-6 inside panels
- Sidebar items: flex col, gap-1, icon + label pairs
- ControlPanel: use `<label>` + `<input type="range">` for sliders, `<select>` for dropdowns, toggle pattern for switches
- MainCanvas: split view with "Before" and "After" labeled sections, a centered loading skeleton div

### Code quality
- TypeScript interfaces for all props
- No inline style objects — Tailwind only
- Clean component separation — no copy-pasted blocks
- Realistic but minimal placeholder content (no lorem ipsum walls)

Return ONLY the raw TSX/JSX code — no markdown fences, no explanation.
Start directly with the import line or component definitions."""
