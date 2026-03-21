SITE_EXTRACTION_GOAL = """Analyze this website's UI/UX design in detail. Extract and return the following as structured data:

1. **Page type**: What kind of page is this? (e.g., marketing site, dashboard, docs, landing page, pricing page)

2. **Layout structure**: How is the page laid out? Describe the hero section, content sections, grid patterns, sidebar usage, and overall flow.

3. **Visual style**: Describe the color palette, background treatment (light/dark/gradient), border and shadow usage, accent colors, and overall visual tone (minimal, premium, playful, corporate, etc).

4. **Component patterns**: List the key UI components visible — navbar style, card designs, button styles, form elements, panels, modals, code blocks, etc. Be specific about their styling.

5. **Typography**: Describe the font choices, heading hierarchy, text sizes, weights, and spacing.

6. **Spacing rhythm**: Is the spacing tight/dense or airy? Is it consistent? Describe the general padding and margin patterns.

7. **CTA/button patterns**: How are primary and secondary actions styled? Colors, shapes, hover effects.

8. **Dashboard/devtool motifs**: If applicable, describe any developer-tool-like patterns — terminal aesthetics, code styling, data density, settings panels.

9. **Overall UX quality**: Rate the information clarity, visual hierarchy, readability, and navigation flow.

Return all findings as a single structured JSON object with these keys: page_type, layout, visual_style, components, typography, spacing, cta_patterns, devtool_motifs, ux_quality."""


def build_aggregation_prompt(
    site_analyses: list[dict], style_goal: str
) -> str:
    sites_text = ""
    for i, site in enumerate(site_analyses, 1):
        sites_text += f"\n--- Site {i}: {site['url']} ---\n"
        sites_text += str(site["raw_analysis"])
        sites_text += "\n"

    goal_section = ""
    if style_goal:
        goal_section = f"""
The user wants to achieve this style direction: "{style_goal}"
Weight your recommendations toward this goal."""

    return f"""You are a senior UI/UX design consultant. You have been given design analyses of multiple competitor websites. Your job is to synthesize these into a unified design direction.
{goal_section}

Here are the individual site analyses:
{sites_text}

Return ONLY valid JSON (no markdown, no explanation) matching this exact structure:

{{
  "sources": [
    {{
      "url": "the site URL",
      "page_type": "type of page",
      "summary": "one-line summary of the site's design character"
    }}
  ],
  "patterns": {{
    "layout": ["list of layout patterns observed across sites"],
    "visual_style": ["list of visual style patterns"],
    "components": ["list of component patterns"],
    "ux_observations": ["list of UX quality observations"]
  }},
  "recommended_direction": {{
    "theme": "short theme name based on the style goal",
    "guidelines": ["actionable design guidelines that blend the best of the analyzed sites"]
  }}
}}

Rules:
- Be specific and actionable, not generic
- Reference real patterns you saw in the analyses
- Guidelines should be implementable by a frontend developer
- Keep each list item concise (one line)
- Return 4-6 items per pattern list
- Return 4-6 guidelines"""
