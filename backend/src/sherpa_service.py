"""
Sherpa Service: Generates AI-curated guided tours through the codebase.

A "Quest" is an ordered list of buildings to visit with narration for each stop.
The AI receives the full city graph (buildings + roads) and generates a logical path.
"""

import json
import os
from typing import Optional
from src.llm_service import build_sherpa_chain

_sherpa_chain = build_sherpa_chain()

QUEST_TEMPLATES = {
    "architecture": {
        "title": "🏛️ Architecture Overview",
        "description": "Understand the high-level structure of this codebase",
        "prompt": "Trace the architectural layers from entry points to core logic.",
    },
    "data_flow": {
        "title": "🌊 Data Flow Journey",
        "description": "Follow data from API entry to storage",
        "prompt": "Trace how data flows from the API layer through processing to storage.",
    },
    "hotspots": {
        "title": "🔥 Technical Debt Tour",
        "description": "Visit the most complex and problematic files",
        "prompt": "Visit the most complex files that need refactoring, explaining why each is problematic.",
    },
    "onboarding": {
        "title": "👋 New Developer Onboarding",
        "description": "Start here if you're new to the codebase",
        "prompt": "Create a beginner-friendly tour starting from the simplest files and building up to core logic.",
    },
    "dependencies": {
        "title": "🕸️ Dependency Deep Dive",
        "description": "Understand the most connected and critical modules",
        "prompt": "Visit the most highly connected files (hubs) and explain their role in the system.",
    },
}


async def generate_quest(
    quest_type: str,
    buildings: list[dict],
    roads: list[dict],
) -> dict:
    """
    Generate a guided tour quest using Claude via Bedrock.

    Returns:
    {
      "title": str,
      "description": str,
      "steps": [
        {
          "building_id": str,
          "building_name": str,
          "order": int,
          "narration": str,
          "focus": str,
        }
      ]
    }
    """
    template = QUEST_TEMPLATES.get(quest_type, QUEST_TEMPLATES["architecture"])

    city_summary = _build_city_summary(buildings, roads)

    try:
        result = await _sherpa_chain.ainvoke({
            "quest_title": template["title"],
            "quest_goal":  template["prompt"],
            "city_summary": json.dumps(city_summary, indent=2),
        })

        text = result.strip()

        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]

        quest = json.loads(text)

        # Validate building_ids exist
        valid_ids = {b["file_path"] for b in buildings}
        quest["steps"] = [
            s for s in quest["steps"]
            if s.get("building_id") in valid_ids
        ]

        return quest

    except Exception as e:
        print(f"[sherpa] Quest generation failed: {e}")
        # Fallback: generate a simple tour from the most interesting buildings
        return _fallback_quest(template, buildings, roads)


def _build_city_summary(buildings: list[dict], roads: list[dict]) -> dict:
    """Build a compact summary of the city for the AI prompt."""

    # Calculate connection counts
    connection_count: dict[str, int] = {}
    for road in roads:
        src = road["start_building_id"]
        connection_count[src] = connection_count.get(src, 0) + 1

    # Sort buildings by interestingness (complexity + connections + LOC)
    def interest_score(b):
        meta = b.get("metadata", {})
        return (
            meta.get("complexity", 0) * 2 +
            connection_count.get(b["id"], 0) * 1.5 +
            meta.get("loc", 0) / 100
        )

    top_buildings = sorted(buildings, key=interest_score, reverse=True)[:25]

    return {
        "total_files": len(buildings),
        "total_connections": len(roads),
        "buildings": [
            {
                "file_path":      b["file_path"],
                "language":       b.get("metadata", {}).get("language", ""),
                "loc":            b.get("metadata", {}).get("loc", 0),
                "complexity":     b.get("metadata", {}).get("complexity", 0),
                "function_count": b.get("metadata", {}).get("function_count", 0),
                "is_hotspot":     b.get("metadata", {}).get("is_hotspot", False),
                "connections":    connection_count.get(b["id"], 0),
                "ai_summary":     b.get("metadata", {}).get("ai_summary", "")[:100],
            }
            for b in top_buildings
        ],
    }


def _fallback_quest(template: dict, buildings: list, roads: list) -> dict:
    """Fallback quest when AI fails — picks top buildings by metrics."""

    if template["title"] == QUEST_TEMPLATES["hotspots"]["title"]:
        picks = sorted(buildings, key=lambda b: b.get("metadata", {}).get("complexity", 0), reverse=True)[:5]
    else:
        picks = sorted(buildings, key=lambda b: b.get("metadata", {}).get("loc", 0), reverse=True)[:5]

    return {
        "title": template["title"],
        "description": f"A guided tour of the most important files in this codebase.",
        "steps": [
            {
                "building_id":   b["file_path"],
                "building_name": b["file_path"].split("/")[-1],
                "order":         i + 1,
                "narration":     f"This file ({b['file_path'].split('/')[-1]}) has {b.get('metadata', {}).get('loc', 0)} lines of code and a complexity score of {b.get('metadata', {}).get('complexity', 0):.1f}. {b.get('metadata', {}).get('ai_summary', '')}",
                "focus":         "purpose",
            }
            for i, b in enumerate(picks)
        ],
    }


def get_quest_types() -> list[dict]:
    """Return available quest types for the frontend."""
    return [
        {"id": key, "title": val["title"], "description": val["description"]}
        for key, val in QUEST_TEMPLATES.items()
    ]
