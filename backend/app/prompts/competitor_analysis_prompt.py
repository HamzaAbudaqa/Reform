SITE_EXTRACTION_GOAL = """You are a real user exploring this website for the first time. Do not just describe the UI — experience it.

INSTRUCTIONS:
1. Land on the page. Note what you see first.
2. Scroll down through the full page.
3. If there is a primary CTA or interactive element, click it.
4. If there are navigation links or tabs, try at least one.
5. Observe: hover effects, transitions, loading states, visual feedback.

Then return ONLY a JSON object with exactly these 8 keys. No markdown fences. No explanation. Just the JSON.

CRITICAL RULES:
- All design tokens must be directly usable in code (no descriptive phrases).
- Colors must be real hex values sampled from the rendered page.
- Shadows must be valid CSS box-shadow values.
- Borders must be valid CSS border shorthand values.
- Font families must be real font names observed on the page.
- Use short snake_case identifiers for pattern lists, not sentences.
- ux_flow must describe what a USER experiences step by step, not what the page contains.
- ux_quality must describe HOW the experience feels, not what elements exist.

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

  "typography": {
    "font_family": "Actual font name, fallback, sans-serif",
    "font_mono": "Actual mono font, monospace",
    "scale": ["12px", "14px", "16px", "20px", "24px", "32px", "48px"],
    "weight_normal": "400",
    "weight_medium": "500",
    "weight_bold": "700"
  },

  "design_tokens": {
    "theme": "dark | light | mixed",
    "colors": {
      "background": "#hex",
      "surface": "#hex",
      "text_primary": "#hex",
      "text_secondary": "#hex",
      "accent_primary": "#hex",
      "accent_secondary": "#hex",
      "success": "#hex",
      "warning": "#hex",
      "error": "#hex",
      "border": "rgba(r,g,b,a)"
    },
    "border_radius": "6px",
    "spacing_scale": ["4px", "8px", "12px", "16px", "24px", "32px"],
    "shadow": {
      "sm": "0 1px 2px rgba(...)",
      "md": "0 4px 8px rgba(...)",
      "lg": "0 8px 24px rgba(...)"
    },
    "border": {
      "default": "1px solid rgba(...)"
    },
    "motion": {
      "duration_fast": "150ms",
      "duration_normal": "200ms",
      "easing": "ease-out"
    },
    "density": "compact | comfortable | spacious"
  },

  "ux_flow": [
    "user_lands_on_dark_hero_with_headline",
    "attention_drawn_to_green_cta_button",
    "scrolls_past_feature_cards_with_hover_lift",
    "clicks_get_started_cta",
    "sees_signup_form_or_dashboard_preview",
    "notices_social_proof_strip_below_fold"
  ],

  "ux_quality": [
    "clear_primary_action_within_2_seconds",
    "fast_hover_feedback_on_interactive_elements",
    "low_cognitive_load_single_focus_per_section",
    "strong_visual_hierarchy_guides_eye_path",
    "smooth_scroll_transitions_between_sections",
    "no_layout_shift_during_page_load"
  ]
}

IMPORTANT for ux_flow:
- Describe real user steps, not page sections.
- Start with "user_lands_on..." or "user_sees..."
- Include what draws attention, what action is taken, what happens after.
- If you clicked something, describe what appeared.

IMPORTANT for ux_quality:
- Describe HOW the experience feels, not WHAT exists.
- Include: clarity, speed, cognitive load, feedback quality, focus.
- Bad: "has_a_navbar" — Good: "clear_primary_action_within_2_seconds"

Fill every key. If a component type is not visible on the page, use ["not_present"]. Inspect colors from the actual rendered page. List 4-6 items per array. All shadow, border, and motion values must be valid CSS."""


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
      "accent_primary": "#hex",
      "accent_secondary": "#hex",
      "success": "#hex",
      "warning": "#hex",
      "error": "#hex",
      "border": "rgba(...)"
    }},
    "typography": {{
      "font_family": "font name, fallback, sans-serif",
      "font_mono": "mono font, monospace",
      "scale": ["12px", "14px", "16px", "20px", "24px", "32px", "48px"],
      "weight_normal": "400",
      "weight_medium": "500",
      "weight_bold": "700"
    }},
    "border_radius": "value",
    "spacing_scale": ["4px", "8px", "12px", "16px", "24px", "32px"],
    "shadow": {{
      "sm": "0 1px 2px rgba(...)",
      "md": "0 4px 8px rgba(...)",
      "lg": "0 8px 24px rgba(...)"
    }},
    "border": {{
      "default": "1px solid rgba(...)"
    }},
    "motion": {{
      "duration_fast": "150ms",
      "duration_normal": "200ms",
      "easing": "ease-out"
    }},
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
- ALL design tokens must be concrete, code-usable values — no descriptive phrases
- Shadow values must be valid CSS box-shadow
- Border values must be valid CSS border shorthand
- Typography must include real font names observed across the analyzed sites
- Colors must include accent_primary, accent_secondary, success, warning, error
- Return ONLY the JSON object"""
