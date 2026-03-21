import json
import logging
import os

import anthropic

from app.prompts.code_transform_prompt import build_code_analysis_prompt

logger = logging.getLogger(__name__)


def _build_files_summary(files: list[dict], max_preview: int = 200) -> str:
    parts = []
    for f in files:
        content = f["content"]
        if len(content) > max_preview:
            preview = content[:max_preview] + f"\n... ({len(content)} chars total)"
        else:
            preview = content
        parts.append(f"### {f['path']} ({f['size']} bytes)\n```\n{preview}\n```")
    return "\n\n".join(parts)


async def analyze_code(files: list[dict], focus: str = "") -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured")

    files_summary = _build_files_summary(files)
    prompt = build_code_analysis_prompt(files_summary, focus)

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:])
        if raw.endswith("```"):
            raw = raw[: raw.rfind("```")].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse code analysis: %s", e)
        return _fallback_analysis(files)


def _fallback_analysis(files: list[dict]) -> dict:
    entry_points = []
    layout_files = []
    components = []
    dep_map = {}
    target = ""

    for f in files:
        path = f["path"]
        content = f["content"]
        if "page.tsx" in path or "page.jsx" in path or path.endswith("index.tsx"):
            entry_points.append(path)
            if not target:
                target = path
        elif "layout.tsx" in path or "layout.jsx" in path:
            layout_files.append(path)

        comp_type = "page" if "page." in path else "layout" if "layout." in path else "style" if path.endswith((".css", ".scss")) else "config" if "config" in path else "component"
        name = path.split("/")[-1].replace(".tsx", "").replace(".jsx", "").replace(".ts", "")
        imports = []
        for line in content.split("\n"):
            line = line.strip()
            if line.startswith("import ") and " from " in line:
                from_part = line.split(" from ")[-1].strip().strip("'\"").strip(";")
                if from_part.startswith(".") or from_part.startswith("@/"):
                    imports.append(from_part)
        components.append({"name": name, "file_path": path, "type": comp_type, "description": f"{comp_type} file", "imports": imports, "exports": [name]})
        dep_map[path] = imports

    if not target and entry_points:
        target = entry_points[0]
    elif not target and files:
        target = files[0]["path"]

    return {
        "entry_points": entry_points, "layout_files": layout_files,
        "components": components, "dependency_map": dep_map,
        "recommended_target": target, "target_reason": "Primary page file detected",
    }
