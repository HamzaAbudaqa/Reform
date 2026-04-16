"""
Named profiles for Anthropic `messages.create` calls on the transform pipeline.

Two profiles:
  - STABLE: low temperature for deterministic, reproducible output. The default
    for paid, user-facing transforms so a second run on the same commit gives
    essentially the same result.
  - EXPLORE: higher temperature for creative, varied output. Used when the
    user opts into a fresh re-analysis via `?mode=explore`.

Callers import `get_profile(name)` and splat the dict into `messages.create`:

    params = get_profile("stable")
    client.messages.create(**params, max_tokens=..., messages=[...])

Keeping the model+temperature in one place means we can retune without
chasing every call site.
"""

from __future__ import annotations

# The model used across the transform pipeline. Kept here so a single edit
# changes every stage at once.
_DEFAULT_MODEL = "claude-sonnet-4-6"


# Profile name → kwargs for anthropic.messages.create.
# Only the knobs that matter for determinism live here. max_tokens and the
# system prompt stay at the call site because they're stage-specific.
_PROFILES: dict[str, dict] = {
    "stable": {
        "model": _DEFAULT_MODEL,
        "temperature": 0.2,
    },
    "explore": {
        "model": _DEFAULT_MODEL,
        "temperature": 0.7,
    },
}

STABLE = "stable"
EXPLORE = "explore"


def get_profile(name: str | None) -> dict:
    """Return the kwargs dict for the named profile.

    Unknown / missing names fall back to STABLE — the transform pipeline
    prefers determinism over creativity by default.
    """
    key = (name or STABLE).lower()
    return dict(_PROFILES.get(key, _PROFILES[STABLE]))


def describe_profile(name: str | None) -> dict:
    """Return a serialisable description of the profile for persistence.

    The run row stores this on `TransformRun.model_params` so we can later
    answer "what params produced this output?".
    """
    key = (name or STABLE).lower()
    params = _PROFILES.get(key, _PROFILES[STABLE])
    return {
        "profile": key,
        "model": params["model"],
        "temperature": params["temperature"],
    }
