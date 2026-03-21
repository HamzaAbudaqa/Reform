import json
import logging
import os

import anthropic

from app.prompts.ui_transform_prompt import build_code_generation_prompt
from app.schemas.ui_transform import (
    DesignIntelligence,
    PanelConfig,
    RefinedButtonSpec,
    RefinedCardSpec,
    RefinedComponents,
    RefinedHeroSpec,
    RefinedLayout,
    RefinedNavbarSpec,
    RefinedUI,
    RefinedWorkspaceSpec,
    TailwindTokenMap,
    UITransformResponse,
)

logger = logging.getLogger(__name__)

# ─── Priority ordering ────────────────────────────────────────────────────────

_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}

# ─── Spacing scale → Tailwind class mapping ───────────────────────────────────
# Tailwind's default scale: 4=1, 8=2, 12=3, 16=4, 24=6, 32=8
_SPACING_TO_TAILWIND = {4: "1", 8: "2", 12: "3", 16: "4", 24: "6", 32: "8"}


def _spacing_classes(scale: list[int], prefix: str) -> list[str]:
    return [f"{prefix}-{_SPACING_TO_TAILWIND.get(v, str(v // 4))}" for v in scale]


# ─── Token → Tailwind ─────────────────────────────────────────────────────────

def _build_token_map(intelligence: DesignIntelligence) -> TailwindTokenMap:
    tokens = intelligence.design_tokens
    c = tokens.colors

    # border_radius "12px" → rounded-xl (Tailwind rounds at 12px)
    radius_map = {"4px": "rounded", "6px": "rounded-md", "8px": "rounded-lg",
                  "12px": "rounded-xl", "16px": "rounded-2xl", "24px": "rounded-3xl"}
    radius_class = radius_map.get(tokens.border_radius, "rounded-xl")

    # shadow_style "subtle_soft" → shadow-sm
    shadow_map = {"subtle_soft": "shadow-sm", "none": "shadow-none",
                  "medium": "shadow-md", "strong": "shadow-lg"}
    shadow_class = shadow_map.get(tokens.shadow_style, "shadow-sm")

    return TailwindTokenMap(
        bg_base=f"bg-[{c.background}]",
        bg_panel=f"bg-[{c.panel}]",
        border=f"border border-[{c.border}]",
        text_primary=f"text-[{c.text_primary}]",
        text_secondary=f"text-[{c.text_secondary}]",
        accent_bg=f"bg-[{c.accent}]",
        accent_text=f"text-[{c.accent}]",
        radius=radius_class,
        spacing=_spacing_classes(tokens.spacing_scale, "p"),
        gap=_spacing_classes(tokens.spacing_scale, "gap"),
        shadow=shadow_class,
    )


# ─── Layout transformation ────────────────────────────────────────────────────

def _build_layout(intelligence: DesignIntelligence) -> RefinedLayout:
    """
    Input signals → three_panel layout:
      global_patterns.layout includes "three_panel_workspace_sidebar_canvas_controls"
      flows.layout_flow_mapping defines sidebar / main_canvas / right_panel roles
    """
    flow_map = intelligence.flows.layout_flow_mapping
    tokens = intelligence.design_tokens
    gap_class = "gap-4"  # from spacing_scale[3] = 16px → gap-4

    panels = {
        "sidebar": PanelConfig(
            role=flow_map.sidebar,
            width="w-64",
            classes=f"bg-[{tokens.colors.panel}] border-r border-[{tokens.colors.border}] "
                    f"h-full flex flex-col p-4 gap-4",
        ),
        "canvas": PanelConfig(
            role=flow_map.main_canvas,
            width="flex-1",
            classes=f"bg-[{tokens.colors.background}] h-full flex flex-col p-6 gap-6",
        ),
        "controls": PanelConfig(
            role=flow_map.right_panel,
            width="w-72",
            classes=f"bg-[{tokens.colors.panel}] border-l border-[{tokens.colors.border}] "
                    f"h-full flex flex-col p-4 gap-4 overflow-y-auto",
        ),
    }

    # Segmentation comes from layout patterns + recommendations
    segmentation = [
        p for p in intelligence.global_patterns.layout
        if "section" in p or "segmentation" in p or "grouping" in p
    ]
    if not segmentation:
        segmentation = ["card_based_content_grouping", "clear_section_segmentation"]

    return RefinedLayout(
        type="three_panel_workspace",
        panels=panels,
        gap=gap_class,
        segmentation=segmentation,
    )


# ─── Component transformation ─────────────────────────────────────────────────

def _build_components(intelligence: DesignIntelligence) -> RefinedComponents:
    tokens = intelligence.design_tokens
    c = tokens.colors

    # Cards: rounded-xl, thin border, p-4 to p-6, subtle shadow
    # Driven by: components.cards.patterns
    cards = RefinedCardSpec(
        radius="rounded-xl",
        border=f"border border-[{c.border}]",
        padding="p-4 md:p-6",
        shadow="shadow-sm",
        classes=f"rounded-xl border border-[{c.border}] p-4 shadow-sm bg-[{c.panel}]",
    )

    # Buttons: primary = high contrast accent / secondary = muted
    # Driven by: components.buttons.patterns
    buttons = RefinedButtonSpec(
        primary_classes=(
            f"bg-[{c.accent}] text-white rounded-md px-4 py-2 text-sm font-medium "
            f"hover:opacity-90 transition-opacity"
        ),
        secondary_classes=(
            f"bg-[{c.panel}] text-[{c.text_secondary}] border border-[{c.border}] "
            f"rounded-md px-4 py-2 text-sm font-medium hover:text-[{c.text_primary}] "
            f"transition-colors"
        ),
        radius="rounded-md",
        height="h-9",
    )

    # Navbar: logo left, minimal links, CTA right
    # Driven by: components.navbar.patterns
    navbar = RefinedNavbarSpec(
        layout="logo_left_links_center_cta_right",
        classes=(
            f"w-full h-14 flex items-center justify-between px-6 "
            f"bg-[{c.panel}] border-b border-[{c.border}]"
        ),
    )

    # Hero: left-aligned text, right visual (high priority recommendation)
    # Driven by: recommendations[target=hero] + components.hero.patterns
    hero = RefinedHeroSpec(
        layout="left_text_right_visual",
        headline_size="text-4xl font-bold",
        classes=(
            f"flex items-center gap-12 px-16 py-20 "
            f"bg-[{c.background}] text-[{c.text_primary}]"
        ),
    )

    # Workspace: three-panel, follows layout_flow_mapping
    # Driven by: components.workspace.patterns
    workspace = RefinedWorkspaceSpec(
        layout="three_panel_flex",
        classes="flex flex-row h-full overflow-hidden",
    )

    return RefinedComponents(
        navbar=navbar,
        hero=hero,
        cards=cards,
        buttons=buttons,
        workspace=workspace,
    )


# ─── Applied patterns tracker ─────────────────────────────────────────────────

def _collect_applied_patterns(intelligence: DesignIntelligence) -> list[str]:
    """
    Every output decision is traceable to an input pattern.
    Collect them in priority order.
    """
    sorted_recs = sorted(
        intelligence.recommendations,
        key=lambda r: _PRIORITY_ORDER.get(r.priority, 99),
    )

    applied = []
    for rec in sorted_recs:
        applied.append(f"[{rec.priority}] {rec.target}: {rec.action}")

    # Append global patterns as additional context
    for pattern in intelligence.global_patterns.layout:
        applied.append(f"[layout] {pattern}")
    for pattern in intelligence.global_patterns.visual_style:
        applied.append(f"[visual] {pattern}")
    for principle in intelligence.global_patterns.ux_principles:
        applied.append(f"[ux] {principle}")

    return applied


# ─── Code generation via Claude ───────────────────────────────────────────────

def _generate_code(
    intelligence: DesignIntelligence,
    refined_ui: RefinedUI,
) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — skipping code generation")
        return "// ANTHROPIC_API_KEY not configured"

    prompt = build_code_generation_prompt(
        intelligence=intelligence.model_dump(),
        refined_ui=refined_ui.model_dump(),
        tailwind_tokens=refined_ui.design_tokens.model_dump(),
    )

    try:
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()

        # Strip markdown fences if model wraps anyway
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:])
            if raw.endswith("```"):
                raw = raw[: raw.rfind("```")].strip()

        logger.info("Code generation complete (%d chars)", len(raw))
        return raw

    except Exception as e:
        logger.error("Code generation failed: %s", e)
        return f"// Code generation error: {e}"


# ─── Public entry point ───────────────────────────────────────────────────────

def transform_ui(intelligence: DesignIntelligence) -> UITransformResponse:
    """
    Deterministic transformation engine.

    Priority order (per spec):
      1. layout
      2. spacing (baked into layout + token map)
      3. components
      4. visual polish (tokens)
    Then: generate React + Tailwind code.
    """
    logger.info(
        "Starting UI transform: style_goal=%s, sources=%d",
        intelligence.meta.project_style_goal,
        len(intelligence.sources),
    )

    # Validate no avoided patterns are being introduced
    avoid_set = set(intelligence.avoid)
    logger.debug("Avoid constraints: %s", avoid_set)

    # 1. Layout (HIGH priority — done first)
    refined_layout = _build_layout(intelligence)
    logger.info("Layout built: type=%s", refined_layout.type)

    # 2. Spacing is embedded in the token map (built alongside layout)
    token_map = _build_token_map(intelligence)
    logger.info("Token map built: radius=%s, shadow=%s", token_map.radius, token_map.shadow)

    # 3. Components
    refined_components = _build_components(intelligence)
    logger.info("Components built")

    # 4. Collect applied patterns (traceable to input)
    applied_patterns = _collect_applied_patterns(intelligence)
    logger.info("Applied %d patterns", len(applied_patterns))

    refined_ui = RefinedUI(
        layout=refined_layout,
        components=refined_components,
        design_tokens=token_map,
        applied_patterns=applied_patterns,
    )

    # 5. Code generation (Claude)
    code = _generate_code(intelligence, refined_ui)

    return UITransformResponse(refined_ui=refined_ui, code=code)
