def mock_site_analysis(url: str) -> dict:
    """Return a mock TinyFish analysis for a single site."""
    return {
        "url": url,
        "raw_analysis": {
            "page_type": "marketing site",
            "layout": "Hero section with centered headline, feature grid below, footer with links",
            "visual_style": "Dark background, subtle gradients, monospace accents, high contrast text",
            "components": "Sticky navbar, feature cards with icons, code snippet blocks, CTA buttons with glow effects",
            "typography": "Sans-serif headings (Inter/similar), monospace for code, clear size hierarchy",
            "spacing": "Generous vertical spacing between sections, tight internal card padding",
            "cta_patterns": "Primary: filled with accent color and subtle glow. Secondary: ghost/outline style",
            "devtool_motifs": "Terminal-style code blocks, dark panels, status indicators",
            "ux_quality": "Strong visual hierarchy, clear navigation, fast scanability",
        },
    }


MOCK_RESPONSE = {
    "sources": [
        {
            "url": "https://github.com",
            "page_type": "developer platform",
            "summary": "Clean structural layout with high information density, muted palette, strong typographic hierarchy",
        },
        {
            "url": "https://railway.app",
            "page_type": "marketing site",
            "summary": "Dark premium surfaces with subtle depth, polished gradients, developer-focused density",
        },
    ],
    "patterns": {
        "layout": [
            "left-aligned hero copy with strong product preview",
            "dense but readable dashboard panels",
            "clear card segmentation with consistent spacing",
            "sticky top navigation with minimal links",
            "two-column content layouts for feature sections",
        ],
        "visual_style": [
            "dark graphite background with layered surface depth",
            "subtle border hierarchy using opacity variations",
            "soft accent glows on interactive elements",
            "minimal but premium gradients on hero sections",
            "muted secondary text with high-contrast primary text",
        ],
        "components": [
            "top navbar with restrained links and single CTA",
            "rounded control panels with inner shadow depth",
            "code/terminal style cards with monospace text",
            "icon-led feature cards in grid layout",
            "ghost buttons for secondary actions",
        ],
        "ux_observations": [
            "high information clarity despite content density",
            "strong visual hierarchy guides scanning path",
            "consistent spacing rhythm creates professional feel",
            "developer-focused layout density without clutter",
            "clear affordances on interactive elements",
        ],
    },
    "recommended_direction": {
        "theme": "GitHub x Railway hybrid",
        "guidelines": [
            "use GitHub-like structure, readability, and information architecture",
            "use Railway-like polish, dark premium surfaces, and accent treatments",
            "keep copy concise and technical — write for developers",
            "avoid playful gradients and consumer-app styling",
            "maintain high density without sacrificing scanability",
            "use monospace accents for code/technical elements, sans-serif for UI text",
        ],
    },
}
