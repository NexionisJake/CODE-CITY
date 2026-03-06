from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from src.github_ingestor import download_repo
from src.parser import parse_repo
from src.metrics import calculate_metrics
from src.ai_service import enrich_with_ai
from src.mapper import build_spatial_layout
import json
import asyncio

router = APIRouter()

MAX_FILES = 200


class BuildCityRequest(BaseModel):
    repo_url: str


async def city_pipeline(repo_url: str):
    """Generator that yields SSE-formatted progress events and final data."""

    def event(stage: str, message: str, data: dict = None):
        payload = {"stage": stage, "message": message}
        if data:
            payload["data"] = data
        return f"data: {json.dumps(payload)}\n\n"

    warnings = []
    tmp_dir = None

    try:
        # Stage 1: Download
        yield event("download", "Downloading repository...")
        try:
            tmp_dir = download_repo(repo_url)
        except Exception as e:
            yield event("error", f"Download failed: {e}")
            return

        # Stage 2: Parse
        yield event("parse", "Parsing source files...")
        await asyncio.sleep(0)
        parsed_files = parse_repo(tmp_dir.name)
        if not parsed_files:
            yield event("error", "No parseable source files found.")
            return
        yield event("parse", f"Found {len(parsed_files)} source files...")

        # Cap at MAX_FILES
        if len(parsed_files) > MAX_FILES:
            parsed_files.sort(
                key=lambda f: f["raw_code"].count("\n"),
                reverse=True,
            )
            parsed_files = parsed_files[:MAX_FILES]
            warnings.append(
                f"Repository has many files — showing top {MAX_FILES} by size. "
                f"Smaller files were excluded."
            )

        # Stage 3: Metrics
        yield event("metrics", f"Calculating complexity metrics for {len(parsed_files)} files...")
        await asyncio.sleep(0)
        calculate_metrics(parsed_files)

        # Stage 4: AI enrichment
        yield event("ai", "Generating AI summaries (top 15 files)...")
        await asyncio.sleep(0)
        try:
            await enrich_with_ai(parsed_files)
        except Exception as e:
            warnings.append(f"AI enrichment unavailable: {e}")
            for f in parsed_files:
                if "ai_summary" not in f:
                    f["ai_summary"] = "AI enrichment unavailable"

        # Stage 5: Layout
        yield event("layout", "Building city layout...")
        await asyncio.sleep(0)
        buildings, roads = build_spatial_layout(parsed_files)

        repo_name = repo_url.rstrip("/").split("/")[-1]

        # Final event: full city data
        city_data = {
            "repository": {"name": repo_name},
            "buildings": buildings,
            "roads": roads,
            "warnings": warnings,
            "error": None,
        }
        yield event("complete", "City ready!", city_data)

    finally:
        if tmp_dir is not None:
            tmp_dir.cleanup()


@router.post("/api/build-city")
async def build_city(req: BuildCityRequest):
    return StreamingResponse(
        city_pipeline(req.repo_url),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
