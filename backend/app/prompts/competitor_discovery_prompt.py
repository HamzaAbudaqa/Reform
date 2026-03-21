def build_discovery_prompt(project_description: str) -> str:
    return f"""You are a market intelligence and product design research assistant. A user is building a new product and needs to find the best design references and competitors in the same space.

USER'S PROJECT DESCRIPTION:
"{project_description}"

YOUR TASK:
1. Infer the product category and industry from the description.
2. Identify approximately 50 of the strongest, most relevant companies/products in the same category or adjacent space.
3. Prioritize companies that are:
   - Globally recognized or category leaders
   - Known for strong product design and UX quality
   - Mature products with polished interfaces
   - Direct competitors or strong design references in the same space
   - Mix of large established players and notable startups

RULES:
- Return ONLY the company's official product/homepage URL (e.g., https://linear.app, https://github.com)
- NO aggregator pages (ProductHunt, G2, Capterra, etc.)
- NO social media links (Twitter, LinkedIn, etc.)
- NO app store links
- NO blog posts or articles
- NO documentation-only URLs
- Every URL must be a real, publicly accessible website
- Relevance score: 0.0 to 1.0 (1.0 = direct competitor, 0.5 = adjacent/reference)
- Target exactly 50 companies if possible, minimum 30

Return ONLY valid JSON (no markdown, no explanation, no text outside the JSON):

{{
  "project_category": "short category identifier",
  "competitors": [
    {{
      "name": "Company Name",
      "url": "https://company.com",
      "reason": "Why this company is relevant (one short sentence)",
      "relevance": 0.95
    }}
  ]
}}

Sort by relevance score descending. Return ONLY the JSON object."""
