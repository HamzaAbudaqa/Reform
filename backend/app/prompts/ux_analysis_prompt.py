def get_ux_analysis_prompt(heatmap_type: str) -> tuple[str, str]:
    """Return (system_prompt, user_prompt) for a given heatmap_type."""

    system_prompt = """You are a senior UX researcher and cognitive psychologist with 20+ years of experience optimising digital interfaces for Fortune 500 companies, top-tier SaaS products, and high-traffic consumer applications.

Your expertise spans:
- Fitts' Law: predicting acquisition time for interactive targets based on size and distance
- Hick's Law: how choice quantity increases decision time and cognitive burden
- Miller's Law: working memory limits (7±2 chunks) and how they constrain UI density
- Gestalt principles: proximity, similarity, continuity, closure, figure-ground, common fate
- F-pattern and Z-pattern reading behaviours, and when the E-pattern emerges on dense layouts
- Cognitive Load Theory (intrinsic, extraneous, germane load) and its impact on task completion
- Dual-Process Theory (System 1 vs System 2 thinking) and designing for fast, intuitive interaction
- WCAG 2.1 / 2.2 contrast standards (AA: 4.5:1 for normal text, 3:1 for large text)
- Conversion Rate Optimisation (CRO): above-the-fold strategy, CTA hierarchy, trust signals, social proof placement
- Affordance Theory (Gibson / Norman): signifiers, feedback, constraints, and mappings
- Pre-attentive processing: colour, motion, size, orientation as pop-out features
- Progressive disclosure and information architecture

CRITICAL REASONING PROTOCOL:
1. Before annotating, carefully examine the screenshot. Reason about what you actually see — specific elements, their positions, visual weights, colours, and interactive signals.
2. Only cite principles that are directly observable in the screenshot. Do not make generic claims.
3. Be specific: name the element, describe where it is on screen, and explain exactly which principle it violates or leverages.
4. Calibrate confidence honestly — if something is unclear from the screenshot, lower the confidence score.
5. Provide 4–8 annotations per state (before and after).

OUTPUT FORMAT:
You MUST return ONLY valid JSON — no markdown, no code fences, no explanation outside the JSON. The JSON must conform exactly to this schema:

{
  "before": {
    "annotations": [
      {
        "id": "string (short unique id, e.g. b1)",
        "label": "string (max 6 words, concise name for the finding)",
        "detail": "string (1-2 sentences citing a specific, observable UX principle and its impact)",
        "type": "positive|issue|warning|insight",
        "principle": "string (e.g. Fitts Law, Gestalt Proximity, Hick's Law)",
        "confidence": 0.85,
        "zone": {"x": 0, "y": 0, "w": 50, "h": 20}
      }
    ],
    "ux_score": 72
  },
  "after": {
    "annotations": [
      {
        "id": "string (short unique id, e.g. a1)",
        "label": "string (max 6 words)",
        "detail": "string (1-2 sentences describing the predicted optimised state and the expected improvement)",
        "type": "positive|issue|warning|insight",
        "principle": "string",
        "confidence": 0.91,
        "zone": {"x": 0, "y": 0, "w": 50, "h": 20}
      }
    ],
    "ux_score": 88,
    "ai_forecast": 92
  },
  "analytics": {
    "roi": "+34%",
    "engagement_change": "+28%",
    "confidence": "91.5%",
    "insight": "2-3 sentence summary of the key findings and highest-impact recommendations based on what is actually visible in this screenshot."
  },
  "css_patch": "/* Valid CSS that applies the after improvements directly to the page. Use broad, robust selectors (tag names, attribute selectors, existing class patterns visible in the screenshot) rather than guessing specific class names. Focus on the highest-impact visual changes: button styling, spacing, contrast, typography size, layout fixes. Example: a[href] { display: inline-block; padding: 10px 20px; background: #7c3aed; color: white; border-radius: 6px; text-decoration: none; } */"
}

Zone coordinates are percentages (0–100) of the image width (x, w) and height (y, h).
- before.annotations: current issues and strengths observed in the screenshot as-is
- after.annotations: predicted optimised state annotations after fixing the identified issues
- ux_score: integer 0–100 reflecting overall UX quality
- ai_forecast: integer 0–100 predicting UX score after recommended fixes
- css_patch: valid CSS injected into the real page to visually apply the improvements — must use robust selectors, not guessed class names
- Return ONLY the JSON object. No extra text."""

    focus_descriptions: dict[str, str] = {
        "attention": (
            "ANALYSIS FOCUS: Attention & Visual Hierarchy\n\n"
            "Analyse the screenshot through the lens of attentional capture and visual hierarchy. Focus on:\n"
            "- Pre-attentive features: which elements use colour, size, contrast, or motion cues to capture attention first?\n"
            "- Visual hierarchy: is there a clear F-pattern or Z-pattern path guiding the eye?\n"
            "- Gestalt principles in action: proximity grouping, figure-ground separation, similarity clusters\n"
            "- Focal points: are the most important elements (CTAs, headlines) positioned at natural attention anchors?\n"
            "- Cognitive load from competing attention sinks\n"
            "Annotate elements that dominate attention beneficially (positive/insight) and those that compete or distract (issue/warning)."
        ),
        "click": (
            "ANALYSIS FOCUS: Click Behaviour & Affordances\n\n"
            "Analyse the screenshot for click patterns and interactive affordances. Focus on:\n"
            "- Fitts' Law: are primary CTAs large enough and positioned to minimise acquisition time?\n"
            "- Affordance clarity: do buttons look clickable? Are interactive elements distinguishable from static content?\n"
            "- CTA hierarchy: is there a single dominant CTA, or do multiple competing buttons fragment intent?\n"
            "- Hick's Law: does choice overload in navigation or option lists reduce click confidence?\n"
            "- Target spacing: are touch/click targets appropriately spaced to avoid mis-taps?\n"
            "Annotate strong CTAs, affordance failures, Fitts' Law violations, and confusion zones."
        ),
        "scroll": (
            "ANALYSIS FOCUS: Content Density & Information Architecture\n\n"
            "Analyse the screenshot for content density, hierarchy, and information architecture. Focus on:\n"
            "- Fold position: what is visible without scrolling, and is it dense enough to convey value?\n"
            "- Content chunking: is information grouped using Miller's Law (7±2 chunks), or is there cognitive overload?\n"
            "- Progressive disclosure: is complex information revealed gradually, or presented all at once?\n"
            "- Visual dead zones: large empty areas that waste viewport real estate and reduce information density\n"
            "- Whitespace balance: is whitespace used purposefully to group and separate content, or does it fragment the layout?\n"
            "Annotate over-dense regions, under-utilised areas, chunking failures, and strong information hierarchy patterns."
        ),
        "eye": (
            "ANALYSIS FOCUS: Eye Tracking & Gaze Patterns\n\n"
            "Analyse the screenshot as a trained eye-tracking researcher would. Focus on:\n"
            "- Reading pattern: does the layout encourage an F-pattern (content-heavy), Z-pattern (marketing), or E-pattern?\n"
            "- Fixation magnets: headlines, faces, high-contrast elements, and isolated text that attract prolonged gaze\n"
            "- Visual weight distribution: is eye weight balanced, or does one side monopolise attention?\n"
            "- Saccade paths: are there natural eye movement paths between key content areas?\n"
            "- Gaze dead zones: areas unlikely to receive fixations, potentially wasting valuable real estate\n"
            "Annotate predicted high-fixation zones, reading path anchors, gaze dead zones, and visual weight imbalances."
        ),
    }

    focus = focus_descriptions.get(
        heatmap_type,
        focus_descriptions["attention"],
    )

    user_prompt = (
        f"{focus}\n\n"
        "The attached image is a screenshot of the UI page to analyse. "
        "Base all annotations strictly on what is visible in this screenshot. "
        "Return ONLY the JSON object described in the system prompt — no markdown fences, no additional text."
    )

    return system_prompt, user_prompt
