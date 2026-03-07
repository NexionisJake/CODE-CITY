"""
Social Service: Fetches Slack/Discord discussion data and maps it to files.

Maps channel messages mentioning file names, function names, or error paths
to specific files in the codebase. Returns a "heat score" per file.
"""

import os
import re
import json
import asyncio
import httpx
from datetime import datetime, timezone, timedelta
from collections import defaultdict


# ─── Demo Data ────────────────────────────────────────────────────────────────
# Used when no Slack token is configured.
# Simulates realistic team discussions for hackathon demos.

DEMO_DISCUSSIONS = [
    {
        "user": "priya.sharma",
        "text": "the auth.py is broken again, getting 401 on login",
        "timestamp": "2 hours ago",
        "channel": "#backend-bugs",
        "reactions": ["🔥", "👀", "😭"],
    },
    {
        "user": "arjun.mehta",
        "text": "someone changed utils.py and now the parser fails silently",
        "timestamp": "4 hours ago",
        "channel": "#incidents",
        "reactions": ["😱"],
    },
    {
        "user": "neha.gupta",
        "text": "api.py endpoint POST /build is timing out for large repos",
        "timestamp": "1 hour ago",
        "channel": "#backend-bugs",
        "reactions": ["👀", "🔥", "🔥"],
    },
    {
        "user": "rahul.verma",
        "text": "metrics.py complexity calculation seems wrong for JS files",
        "timestamp": "30 mins ago",
        "channel": "#code-review",
        "reactions": ["🤔"],
    },
    {
        "user": "siddharth.rao",
        "text": "mapper.py is allocating too much memory for large repos",
        "timestamp": "5 hours ago",
        "channel": "#performance",
        "reactions": ["😬", "👀"],
    },
    {
        "user": "priya.sharma",
        "text": "parser.py needs better error handling for C++ templates",
        "timestamp": "Yesterday",
        "channel": "#code-review",
        "reactions": [],
    },
    {
        "user": "arjun.mehta",
        "text": "github_ingestor.py is hitting rate limits — need exponential backoff",
        "timestamp": "3 hours ago",
        "channel": "#backend-bugs",
        "reactions": ["🔥", "😭"],
    },
]


async def fetch_social_data(files: list[dict]) -> dict[str, dict]:
    """
    Main entry point. Returns social heat data per file path.

    Returns:
        {
          file_path: {
            "heat_score":    float,   # 0.0 - 10.0
            "message_count": int,
            "recent_messages": [{"user", "text", "timestamp", "channel", "reactions"}],
            "is_hotspot":    bool,    # heat_score > 5.0
          }
        }
    """
    slack_token = os.getenv("SLACK_BOT_TOKEN")

    if slack_token:
        print("[social] Using real Slack API")
        try:
            return await _fetch_from_slack(slack_token, files)
        except Exception as e:
            print(f"[social] Slack API failed, falling back to demo: {e}")

    print("[social] Using demo social data")
    return _generate_demo_heat(files)


def _generate_demo_heat(files: list[dict]) -> dict[str, dict]:
    """
    Map demo discussions to actual files in the repo using filename matching.
    """
    heat: dict[str, dict] = {}

    for f in files:
        rel_path = f["file_path"]
        filename = rel_path.replace("\\", "/").split("/")[-1]  # e.g. "auth.py"
        stem = filename.rsplit(".", 1)[0]  # e.g. "auth"

        # Find demo messages that mention this file
        matches = []
        for msg in DEMO_DISCUSSIONS:
            text_lower = msg["text"].lower()
            if (
                stem.lower() in text_lower or
                filename.lower() in text_lower
            ):
                matches.append(msg)

        if matches:
            # Score = base per message + reaction bonus
            score = 0.0
            for msg in matches:
                score += 2.0                            # base per message
                score += len(msg.get("reactions", [])) * 0.5  # reactions add heat
                # Recent messages count more
                if "hour" in msg["timestamp"] or "min" in msg["timestamp"]:
                    score += 1.5

            heat[rel_path] = {
                "heat_score":      min(score, 10.0),
                "message_count":   len(matches),
                "recent_messages": matches[:3],  # top 3 for tooltip
                "is_hotspot":      score > 3.0,
            }

    # If nothing matched by filename, assign demo heat to the most complex files
    # (so the demo always shows SOMETHING glowing)
    if len(heat) < 3 and files:
        sorted_files = sorted(files, key=lambda x: x.get("complexity", 0), reverse=True)
        for f in sorted_files[:3]:
            if f["file_path"] not in heat:
                heat[f["file_path"]] = {
                    "heat_score":    5.0 + sorted_files.index(f),
                    "message_count": 2,
                    "recent_messages": [DEMO_DISCUSSIONS[0], DEMO_DISCUSSIONS[2]],
                    "is_hotspot":    True,
                }

    print(f"[social] Mapped {len(heat)} files with social heat")
    return heat


async def _fetch_from_slack(token: str, files: list[dict]) -> dict[str, dict]:
    """
    Real Slack API integration.
    Searches public channels for messages mentioning file names.
    """
    heat: dict[str, dict] = defaultdict(lambda: {
        "heat_score": 0.0, "message_count": 0,
        "recent_messages": [], "is_hotspot": False
    })

    # Build filename lookup
    file_stems = {
        f["file_path"].replace("\\", "/").split("/")[-1].rsplit(".", 1)[0]: f["file_path"]
        for f in files
    }

    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=10) as client:
        # Get list of channels
        resp = await client.get(
            "https://slack.com/api/conversations.list",
            headers=headers,
            params={"types": "public_channel", "limit": 20}
        )
        channels_data = resp.json()
        if not channels_data.get("ok"):
            raise ValueError(f"Slack API error: {channels_data.get('error')}")

        channels = channels_data.get("channels", [])

        # Search each channel for file mentions (last 7 days)
        oldest = str((datetime.now(timezone.utc) - timedelta(days=7)).timestamp())

        for channel in channels[:10]:  # cap at 10 channels
            ch_id = channel["id"]

            try:
                resp = await client.get(
                    "https://slack.com/api/conversations.history",
                    headers=headers,
                    params={"channel": ch_id, "oldest": oldest, "limit": 100}
                )
                msgs = resp.json().get("messages", [])

                for msg in msgs:
                    text = msg.get("text", "").lower()
                    for stem, file_path in file_stems.items():
                        if stem.lower() in text:
                            entry = heat[file_path]
                            entry["heat_score"] = min(entry["heat_score"] + 2.0, 10.0)
                            entry["message_count"] += 1
                            entry["recent_messages"].append({
                                "user":      msg.get("user", "unknown"),
                                "text":      msg.get("text", "")[:120],
                                "timestamp": datetime.fromtimestamp(
                                    float(msg.get("ts", 0))
                                ).strftime("%b %d %H:%M"),
                                "channel":   f"#{channel.get('name', 'unknown')}",
                                "reactions": [
                                    r["name"] for r in msg.get("reactions", [])
                                ],
                            })
            except Exception:
                continue

    for path, data in heat.items():
        data["is_hotspot"] = data["heat_score"] > 3.0

    return dict(heat)
