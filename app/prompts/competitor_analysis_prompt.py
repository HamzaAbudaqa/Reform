SITE_EXTRACTION_GOAL = """Analyze this website's UI/UX design. Return ONLY a JSON object with exactly these 8 keys. No markdown fences. No explanation. Just the JSON.

Use short snake_case identifiers, not sentences. Example: "dark_graphite_background" not "The background is dark".

{
  "page_type": "single_string_identifier",

  "layout": [
    "pattern_identifier_1",
    "pattern_identifier_2"
  ],

  "visual_style": [
    "pattern_identifier_1",
    "pattern_identifier_2"
  ],

  "components": {
    "navbar": ["pattern_1", "pattern_2"],
    "hero": ["pattern_1", "pattern_2"],
    "cards": ["pattern_1", "pattern_2"],
    "buttons": ["pattern_1", "pattern_2"],
    "workspace": ["pattern_1", "pattern_2"],
    "forms_controls": ["pattern_1", "pattern_2"]
  },

  "typography": "font_family_base_size_scale_description",

  "design_tokens": {
    "theme": "dark | light | mixed",
    "colors": {
      "background": "#hex",
      "surface": "#hex",
      "text_primary": "#hex",
      "text_secondary": "#hex",
      "accent": "#hex",
      "border": "rgba(...)"
    },
    "border_radius": "value",
    "spacing_scale": ["4px", "8px", "16px", "24px", "32px"],
    "shadow_style": "descriptor",
    "border_style": "descriptor",
    "density": "compact | comfortable | spacious"
  },

  "ux_flow": [
    "step_1_action",
    "step_2_action",
    "step_3_action"
  ],

  "ux_quality": [
    "observation_identifier_1",
    "observation_identifier_2"
  ]
}

Fill every key. If a component type is not visible on the page, use ["not_present"]. Inspect colors from the actual rendered page. List 3-6 items per array."""


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
STYLE GOAL: "{style_goal}"
You MUST bias all pattern extraction and recommendations toward this goal.
If the goal references specific products (e.g., "github_railway_hybrid"), weight patterns from those products accordingly."""

    return f"""You are a senior design system architect. You have raw design analyses from multiple competitor websites. Your job is to synthesize them into a unified, reusable design intelligence output.
{goal_section}

Here are the individual site analyses:
{sites_text}

Return ONLY valid JSON (no markdown, no explanation, no text outside the JSON) matching this EXACT structure:

{{
  "meta": {{
    "project_style_goal": "{style_goal or 'none_specified'}",
    "description": "one-line description of the synthesized design direction",
    "confidence": {{
      "layout_patterns": 0.0,
      "visual_style": 0.0,
      "ux_flow": 0.0
    }}
  }},
  "sources": [
    {{
      "url": "the site URL",
      "page_type": "specific page type identifier",
      "summary": "one-line design character summary using structured terms"
    }}
  ],
  "global_patterns": {{
    "layout": ["pattern_name_as_identifier"],
    "visual_style": ["pattern_name_as_identifier"],
    "ux_principles": ["principle_as_identifier"]
  }},
  "components": {{
    "navbar": {{ "patterns": [] }},
    "hero": {{ "patterns": [] }},
    "cards": {{ "patterns": [] }},
    "buttons": {{ "patterns": [] }},
    "workspace": {{ "patterns": [] }},
    "forms_controls": {{ "patterns": [] }}
  }},
  "design_tokens": {{
    "theme": "dark|light|mixed",
    "colors": {{
      "background": "#hex",
      "surface": "#hex",
      "text_primary": "#hex",
      "text_secondary": "#hex",
      "accent": "#hex",
      "border": "rgba(...)"
    }},
    "border_radius": "value",
    "spacing_scale": ["4px", "8px", "16px", "24px", "32px", "48px"],
    "shadow_style": "descriptor",
    "border_style": "descriptor",
    "density": "compact|comfortable|spacious"
  }},
  "flows": {{
    "primary_user_flow": ["step1", "step2", "step3"],
    "interaction_patterns": ["pattern_identifier"],
    "layout_flow_mapping": {{
      "section_name": "flow_role"
    }}
  }},
  "recommendations": [
    {{
      "priority": "high|medium|low",
      "target": "specific_component_or_area",
      "action": "concrete_actionable_instruction"
    }}
  ],
  "avoid": ["anti_pattern_identifier"]
}}

RULES:
- Use short structured identifiers, NOT sentences (e.g., "left_aligned_hero_with_cta" not "The hero section is left-aligned with a call to action")
- Find COMMON patterns across sites, ignore outliers
- Confidence scores: 0.0-1.0 based on how consistent the pattern is across sources
- 4-6 items per pattern list
- 4-6 recommendations, prioritized: high = layout + spacing first
- 3-5 items in avoid list — specific anti-patterns that break the target style
- Design tokens must be concrete inferred values, not descriptions
- Return ONLY the JSON object"""
