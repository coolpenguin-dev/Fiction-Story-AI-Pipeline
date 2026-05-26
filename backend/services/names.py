import re
from typing import Any

# ChoiceScript / interactive fiction variable tokens: #myname#, #fname#, etc.
HASH_VAR_RE = re.compile(r"#([a-zA-Z_][a-zA-Z0-9_]*)#")
MC_VAR_NAMES = frozenset(
    {"myname", "yourname", "playername", "name", "firstname", "mcname", "pcname"}
)
# Single surname word only — avoids capturing "#myname# Hayes is ..." as "Hayes is"
SURNAME_AFTER_MC_RE = re.compile(
    r"#(?:myname|yourname|playername|mcname)#\s+([A-Z][a-z]{1,30})\b",
    re.IGNORECASE,
)
BRACE_VAR_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
LEGACY_MC_RE = re.compile(r"MC \(reader\)(?:\s+([A-Za-z]+))?")
YOU_LABEL_RE = re.compile(r"You\s*\(\s*([^)]+)\s*\)", re.IGNORECASE)

# Words that follow a surname in prose but are not part of the name
SURNAME_STOPWORDS = frozenset(
    {
        "is", "are", "was", "were", "am", "be", "been", "being",
        "the", "a", "an", "and", "or", "but", "who", "that", "this",
        "in", "on", "at", "to", "for", "with", "as", "by", "from",
        "has", "have", "had", "will", "would", "can", "could",
    }
)


def clean_surname(raw: str | None) -> str | None:
    """Keep only the actual surname token(s), not following prose."""
    if not raw:
        return None
    parts = re.findall(r"[A-Za-z]+", raw.strip())
    kept: list[str] = []
    for part in parts:
        if part.lower() in SURNAME_STOPWORDS:
            break
        kept.append(part)
    if not kept:
        return None
    # Interactive scripts almost always use one fixed surname after #myname#
    return kept[0]


def protagonist_label(surname: str | None = None) -> str:
    """Display label for the reader-chosen protagonist."""
    cleaned = clean_surname(surname)
    if cleaned:
        return f"You ({cleaned})"
    return "You"


def extract_script_name_context(text: str) -> dict[str, Any]:
    """Detect interactive-fiction name placeholders in source text."""
    hash_vars = HASH_VAR_RE.findall(text)
    mc_vars = [
        v
        for v in hash_vars
        if v.lower() in MC_VAR_NAMES or v.lower().endswith("name")
    ]
    surname_match = SURNAME_AFTER_MC_RE.search(text)
    mc_surname = (
        clean_surname(surname_match.group(1)) if surname_match else None
    )
    label = protagonist_label(mc_surname)

    return {
        "hasPlaceholders": bool(hash_vars) or bool(BRACE_VAR_RE.search(text)),
        "hashVariables": sorted(set(hash_vars)),
        "mcVariables": sorted(set(mc_vars)),
        "mcLabel": label,
        "mcSurname": mc_surname,
    }


def _replace_hash_placeholder(match: re.Match[str], label: str) -> str:
    var = match.group(1)
    if var.lower() in MC_VAR_NAMES or var.lower().endswith("name"):
        return label
    return f"[{var}]"


def _legacy_mc_replacer(match: re.Match[str]) -> str:
    surname = match.group(1)
    return protagonist_label(surname)


def _fix_you_label_match(match: re.Match[str]) -> str:
    return protagonist_label(match.group(1))


def fix_you_labels_in_text(text: str) -> str:
    """Normalize «You (Hayes is)» → «You (Hayes)» everywhere."""
    return YOU_LABEL_RE.sub(_fix_you_label_match, text)


def _resolve_label(default_label: str) -> str:
    match = YOU_LABEL_RE.fullmatch(default_label.strip())
    if match:
        return protagonist_label(match.group(1))
    if default_label.strip().lower() == "you":
        return "You"
    return default_label


def sanitize_display_text(text: str, default_label: str = "You") -> str:
    """Replace script variable tokens with human-readable labels."""
    if not text or not isinstance(text, str):
        return text

    label = _resolve_label(default_label)

    out = re.sub(
        r"#(?:myname|yourname|playername|mcname)#\s+([A-Z][a-z]{1,30})\b",
        lambda m: protagonist_label(m.group(1)),
        text,
        flags=re.IGNORECASE,
    )
    for mc_var in MC_VAR_NAMES:
        out = re.sub(rf"#{mc_var}#", label, out, flags=re.IGNORECASE)

    out = HASH_VAR_RE.sub(lambda m: _replace_hash_placeholder(m, label), out)
    out = BRACE_VAR_RE.sub(
        lambda m: label
        if m.group(1).lower() in MC_VAR_NAMES or m.group(1).lower().endswith("name")
        else f"[{m.group(1)}]",
        out,
    )

    out = LEGACY_MC_RE.sub(_legacy_mc_replacer, out)
    out = fix_you_labels_in_text(out)

    you_base = "You"
    out = re.sub(rf"({re.escape(you_base)}\s+)+", f"{you_base} ", out)
    out = re.sub(r"\s{2,}", " ", out).strip()
    return out


def _sanitize_value(value: Any, default_label: str) -> Any:
    if isinstance(value, str):
        return sanitize_display_text(value, default_label)
    if isinstance(value, list):
        return [_sanitize_value(item, default_label) for item in value]
    if isinstance(value, dict):
        return {k: _sanitize_value(v, default_label) for k, v in value.items()}
    return value


def sanitize_analysis_names(data: dict, source_text: str) -> dict:
    """Post-process LLM JSON so relationship pairs never show raw #myname# tokens."""
    ctx = extract_script_name_context(source_text)
    label = ctx["mcLabel"]

    data = _sanitize_value(data, label)

    if ctx["hasPlaceholders"]:
        note = (
            f"Interactive script variables detected ({', '.join(ctx['hashVariables'][:8])}). "
            f"Protagonist shown as «{label}» where the manuscript uses #myname#-style tokens."
        )
        existing = data.get("canonicalPathNote") or ""
        existing = fix_you_labels_in_text(existing)
        if note not in existing:
            data["canonicalPathNote"] = f"{existing} {note}".strip()
        else:
            data["canonicalPathNote"] = existing

    data["nameResolution"] = {
        "protagonistLabel": label,
        "mcLabel": label,
        "mcSurname": ctx["mcSurname"],
        "mcVariables": ctx["mcVariables"],
        "placeholdersSanitized": ctx["hasPlaceholders"],
    }

    return data
