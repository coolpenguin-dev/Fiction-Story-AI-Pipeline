from typing import Any


def build_story_state(analysis: dict[str, Any]) -> dict[str, Any]:
    """Build a lightweight coherence snapshot from an analysis result."""
    patterns_raw = analysis.get("patterns") or []
    relationships_raw = analysis.get("relationships") or []
    scenes_raw = analysis.get("scenes") or []

    patterns: list[dict[str, str]] = []
    if isinstance(patterns_raw, list):
        for item in patterns_raw[:3]:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            patterns.append(
                {
                    "name": name,
                    "description": str(item.get("description") or "").strip(),
                }
            )

    relationships: list[dict[str, str]] = []
    if isinstance(relationships_raw, list):
        for row in relationships_raw[:10]:
            if not isinstance(row, dict):
                continue
            pair = str(row.get("pair") or "").strip()
            if not pair:
                continue
            relationships.append(
                {
                    "pair": pair,
                    "chapterOrScene": str(row.get("chapterOrScene") or "").strip(),
                    "trust": str(row.get("trust") or "").strip(),
                    "tension": str(row.get("tension") or "").strip(),
                    "intimacy": str(row.get("intimacy") or "").strip(),
                    "notes": str(row.get("notes") or "").strip(),
                }
            )

    open_threads: list[str] = []
    seen_threads: set[str] = set()
    if isinstance(scenes_raw, list):
        tail = scenes_raw[-5:] if len(scenes_raw) > 5 else scenes_raw
        for scene in reversed(tail):
            if not isinstance(scene, dict):
                continue
            threads = scene.get("openThreads") or []
            if not isinstance(threads, list):
                continue
            for thread in threads:
                text = str(thread or "").strip()
                if text and text not in seen_threads:
                    seen_threads.add(text)
                    open_threads.append(text)

    characters: list[str] = []
    if isinstance(scenes_raw, list) and scenes_raw:
        for scene in scenes_raw[-3:]:
            if not isinstance(scene, dict):
                continue
            chars = scene.get("characters") or []
            if isinstance(chars, list):
                for char in chars:
                    name = str(char or "").strip()
                    if name and name not in characters:
                        characters.append(name)

    return {
        "patterns": patterns,
        "relationships": relationships,
        "openThreads": open_threads[:8],
        "characters": characters[:8],
        "sceneCount": len(scenes_raw) if isinstance(scenes_raw, list) else 0,
    }


def format_story_state_block(state: dict[str, Any] | None) -> str:
    """Render story state for LLM prompts."""
    if not state:
        return "(No analyzed story state — rely on the outline.)"

    sections: list[str] = []

    characters = state.get("characters") or []
    if isinstance(characters, list) and characters:
        sections.append(f"Key characters: {', '.join(str(c) for c in characters if c)}")

    patterns = state.get("patterns") or []
    if isinstance(patterns, list) and patterns:
        lines = []
        for p in patterns[:3]:
            if not isinstance(p, dict):
                continue
            name = p.get("name") or "Pattern"
            desc = p.get("description") or ""
            lines.append(f"- {name}: {desc}".strip())
        if lines:
            sections.append("Narrative patterns:\n" + "\n".join(lines))

    relationships = state.get("relationships") or []
    if isinstance(relationships, list) and relationships:
        lines = []
        for row in relationships[:6]:
            if not isinstance(row, dict):
                continue
            pair = row.get("pair") or "Pair"
            where = row.get("chapterOrScene") or ""
            trust = row.get("trust") or ""
            tension = row.get("tension") or ""
            intimacy = row.get("intimacy") or ""
            notes = row.get("notes") or ""
            metrics = ", ".join(
                x for x in [f"trust={trust}" if trust else "", f"tension={tension}" if tension else "", f"intimacy={intimacy}" if intimacy else ""] if x
            )
            header = f"- {pair}"
            if where:
                header += f" ({where})"
            if metrics:
                header += f" · {metrics}"
            if notes:
                header += f" — {notes}"
            lines.append(header)
        if lines:
            sections.append("Relationship progression:\n" + "\n".join(lines))

    open_threads = state.get("openThreads") or []
    if isinstance(open_threads, list) and open_threads:
        sections.append(
            "Open threads to preserve:\n"
            + "\n".join(f"- {t}" for t in open_threads[:8] if t)
        )

    scene_count = state.get("sceneCount")
    if isinstance(scene_count, int) and scene_count > 0:
        sections.append(f"Analyzed path length: {scene_count} scene(s) on canonical path.")

    if not sections:
        return "(No analyzed story state — rely on the outline.)"

    return "\n\n".join(sections)
