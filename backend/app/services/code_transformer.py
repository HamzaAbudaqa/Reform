import json
import logging
import os

import anthropic

from app.prompts.code_transform_prompt import build_code_transform_prompt, build_preview_html_prompt

logger = logging.getLogger(__name__)


async def transform_code(
    files: list[dict], target_file: str,
    design_intelligence: dict, user_intent: str = "",
) -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured")

    target = None
    supporting = []
    for f in files:
        if f["path"] == target_file:
            target = f
        else:
            supporting.append(f)
    if not target:
        raise ValueError(f"Target file not found: {target_file}")

    supporting_parts = []
    total_chars = 0
    for sf in supporting:
        content = sf["content"]
        if total_chars + len(content) > 30_000:
            if len(content) > 2000:
                content = content[:2000] + "\n// ... truncated"
        total_chars += len(content)
        supporting_parts.append(f"### {sf['path']}\n```tsx\n{content}\n```")
    supporting_text = "\n\n".join(supporting_parts) if supporting_parts else "No supporting files."

    prompt = build_code_transform_prompt(
        target_code=target["content"], target_path=target_file,
        supporting_files=supporting_text, design_intelligence=design_intelligence,
        user_intent=user_intent,
    )

    client = anthropic.Anthropic(api_key=api_key)
    logger.info("Transforming %s (%d chars)", target_file, len(target["content"]))

    message = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=16384,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:])
        if raw.endswith("```"):
            raw = raw[: raw.rfind("```")].strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Failed to parse transform response, extracting JSON")
        result = _extract_json(raw)

    updated_code = result.get("updated_code", "")
    if not updated_code:
        raise ValueError("Transformation returned empty code")

    before_html, after_html = await _generate_previews(client, target["content"], updated_code)

    return {
        "transformed_files": [{
            "path": target_file, "original_code": target["content"],
            "updated_code": updated_code,
            "diff_summary": result.get("diff_summary", "Code refactored based on design intelligence."),
        }],
        "change_annotations": result.get("change_annotations", []),
        "change_summary": result.get("change_summary", []),
        "before_html": before_html, "after_html": after_html,
    }


async def _generate_previews(client, original_code: str, updated_code: str) -> tuple[str, str]:
    try:
        before_msg = client.messages.create(
            model="claude-sonnet-4-6", max_tokens=8192,
            messages=[{"role": "user", "content": build_preview_html_prompt(original_code, "BEFORE", is_before=True)}],
        )
        before_html = _strip_fences(before_msg.content[0].text.strip())

        after_msg = client.messages.create(
            model="claude-sonnet-4-6", max_tokens=8192,
            messages=[{"role": "user", "content": build_preview_html_prompt(updated_code, "AFTER", is_before=False)}],
        )
        after_html = _strip_fences(after_msg.content[0].text.strip())
        return before_html, after_html
    except Exception as e:
        logger.warning("Preview generation failed: %s", e)
        return _fallback_preview("BEFORE"), _fallback_preview("AFTER")


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[: text.rfind("```")].strip()
    return text


def _fallback_preview(label: str) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body {{ background:#09090b; color:#a1a1aa; font-family:Inter,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }}
</style></head><body><p>Preview could not be generated</p></body></html>"""


def _extract_json(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return {"updated_code": text, "diff_summary": "Raw output", "change_annotations": [], "change_summary": []}
    try:
        return json.loads(text[start: end + 1])
    except json.JSONDecodeError:
        return {"updated_code": text, "diff_summary": "Raw output", "change_annotations": [], "change_summary": []}
