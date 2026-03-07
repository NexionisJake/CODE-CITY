from fastapi import APIRouter, Cookie
from fastapi.responses import StreamingResponse, RedirectResponse, JSONResponse
from pydantic import BaseModel
import httpx
import secrets
import os
from src.github_ingestor import download_repo
from src.parser import parse_repo
from src.metrics import calculate_metrics
from src.ai_service import enrich_with_ai
from src.social_service import fetch_social_data
from src.mapper import build_spatial_layout
from src.sherpa_service import generate_quest, get_quest_types
from src.cache_service import get_city, set_city, invalidate_city, get_cache_stats
from src.graph_service import store_city_graph, get_graph_stats
import json
import asyncio

router = APIRouter()

MAX_FILES = 200

GITHUB_CLIENT_ID     = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Simple session store (use Redis in production)
_sessions: dict[str, dict] = {}


class BuildCityRequest(BaseModel):
    repo_url: str


class QuestRequest(BaseModel):
    quest_type: str
    buildings:  list
    roads:      list


class CityQueryRequest(BaseModel):
    question:  str
    buildings: list
    roads:     list


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

        # Stage 3.5: Social data
        yield event("social", "💬 Fetching Slack discussions...")
        await asyncio.sleep(0)
        social_heat = await fetch_social_data(parsed_files)
        for f in parsed_files:
            f["social"] = social_heat.get(f["file_path"], {
                "heat_score": 0.0,
                "message_count": 0,
                "recent_messages": [],
                "is_hotspot": False,
            })

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

        yield event("graph", "🕸️ Storing graph relationships...")
        await asyncio.sleep(0)
        store_city_graph(repo_url, buildings, roads)

        repo_name = repo_url.rstrip("/").split("/")[-1]

        # Final event: full city data
        city_data = {
            "repository": {"name": repo_name},
            "buildings": buildings,
            "roads": roads,
            "warnings": warnings,
            "error": None,
        }
        set_city(repo_url, city_data)
        yield event("complete", "City ready!", city_data)

    finally:
        if tmp_dir is not None:
            tmp_dir.cleanup()


@router.post("/api/build-city")
async def build_city(req: BuildCityRequest):
    cached = get_city(req.repo_url)
    if cached:
        async def cached_stream():
            yield f"data: {json.dumps({'stage': 'complete', 'message': '⚡ Loaded from cache', 'data': cached})}\n\n"
        return StreamingResponse(
            cached_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    return StreamingResponse(
        city_pipeline(req.repo_url),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/api/webhook")
async def github_webhook(payload: dict):
    # Very basic webhook handler to clear cache
    repo_url = payload.get("repository", {}).get("html_url")
    if repo_url:
        invalidate_city(repo_url)
        return {"status": "invalidated", "repo": repo_url}
    return {"status": "ignored"}


@router.get("/health")
async def health():
    return {"status": "ok", "cache": get_cache_stats()}


@router.get("/api/sherpa/quests")
async def list_quests():
    """Return available quest types."""
    return {"quests": get_quest_types()}


@router.get("/api/graph/dependencies/{file_id:path}")
async def get_file_dependencies(file_id: str, repo: str, depth: int = 2):
    """Get all files a given file depends on."""
    from src.graph_service import query_dependencies
    deps = query_dependencies(repo, file_id, depth)
    return {"file_id": file_id, "dependencies": deps}


@router.get("/auth/github")
async def github_login():
    """Redirect to GitHub OAuth."""
    if not GITHUB_CLIENT_ID:
        return JSONResponse({"error": "GitHub OAuth not configured"}, status_code=501)
    state = secrets.token_urlsafe(16)
    return RedirectResponse(
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&scope=repo,read:user"
        f"&state={state}"
    )

@router.get("/auth/github/callback")
async def github_callback(code: str, state: str):
    """Handle GitHub OAuth callback."""
    async with httpx.AsyncClient() as client:
        # Exchange code for token
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id":     GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code":          code,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()
        access_token = token_data.get("access_token", "")
        
        if not access_token:
            return RedirectResponse(f"{FRONTEND_URL}?auth_error=true")
        
        # Fetch user info
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {access_token}"},
        )
        user = user_resp.json()
        
        # Create session
        session_id = secrets.token_urlsafe(32)
        _sessions[session_id] = {
            "github_token": access_token,
            "user":         {
                "login":      user.get("login"),
                "name":       user.get("name"),
                "avatar_url": user.get("avatar_url"),
            },
        }
        
        # Redirect to frontend with session cookie
        response = RedirectResponse(f"{FRONTEND_URL}?auth=success")
        response.set_cookie(
            "codecity_session",
            session_id,
            httponly=True,
            samesite="lax",
            max_age=86400,  # 24 hours
        )
        return response

@router.get("/auth/me")
async def get_current_user(codecity_session: str = Cookie(default="")):
    """Return current authenticated user."""
    session = _sessions.get(codecity_session, {})
    user = session.get("user")
    return {"user": user, "authenticated": bool(user)}

@router.post("/auth/logout")
async def logout(codecity_session: str = Cookie(default="")):
    if codecity_session in _sessions:
        del _sessions[codecity_session]
    response = JSONResponse({"status": "logged out"})
    response.delete_cookie("codecity_session")
    return response


@router.post("/api/sherpa/generate")
async def create_quest(req: QuestRequest):
    """Generate a specific quest for the given city data."""
    quest = await generate_quest(req.quest_type, req.buildings, req.roads)
    return quest


@router.post("/api/ask")
async def ask_the_city(req: CityQueryRequest):
    """Answer a natural language question about the codebase."""
    
    # Build rich context for Claude
    context = _build_query_context(req.buildings, req.roads)
    
    try:
        from src.llm_service import build_query_chain
        _query_chain = build_query_chain()

        answer = await _query_chain.ainvoke({
            "context": context,
            "question": req.question,
        })
        
        # Find buildings mentioned in the answer (to highlight them)
        mentioned_ids = _find_mentioned_buildings(answer, req.buildings)
        
        return {
            "answer":        answer,
            "mentioned_ids": mentioned_ids,
        }
    
    except Exception as e:
        return {
            "answer": f"Sorry, I couldn't process that question right now. ({e})",
            "mentioned_ids": [],
        }


def _build_query_context(buildings: list, roads: list) -> str:
    """Build a rich but concise context string for Claude."""
    
    # Top files by complexity
    top_complex = sorted(buildings, key=lambda b: b.get("metadata", {}).get("complexity", 0), reverse=True)[:8]
    
    # Top files by social heat
    top_social = sorted(
        buildings,
        key=lambda b: b.get("metadata", {}).get("social", {}).get("heat_score", 0),
        reverse=True
    )[:5]
    
    # Top files by LOC
    top_loc = sorted(buildings, key=lambda b: b.get("metadata", {}).get("loc", 0), reverse=True)[:5]
    
    # Hotspot files
    hotspots = [b for b in buildings if b.get("metadata", {}).get("is_hotspot")]
    
    # Recently modified
    recent = [
        b for b in buildings
        if b.get("metadata", {}).get("git_churn", {}).get("is_recent")
    ]
    
    # Highly churned
    churned = [
        b for b in buildings
        if b.get("metadata", {}).get("git_churn", {}).get("is_churned")
    ]
    
    lines = [
        f"Repository: {len(buildings)} files, {len(roads)} dependency connections",
        "",
        "MOST COMPLEX FILES (technical debt candidates):",
    ]
    for b in top_complex:
        meta = b.get("metadata", {})
        lines.append(
            f"  - {b['file_path']} | complexity={meta.get('complexity', 0):.1f} | "
            f"LOC={meta.get('loc', 0)} | {meta.get('ai_summary', '')[:80]}"
        )
    
    lines.append("\nMOST DISCUSSED IN TEAM CHAT:")
    for b in top_social:
        social = b.get("metadata", {}).get("social", {})
        if social.get("message_count", 0) > 0:
            lines.append(
                f"  - {b['file_path']} | {social['message_count']} messages | "
                f"heat={social.get('heat_score', 0):.1f}/10"
            )
            for msg in social.get("recent_messages", [])[:1]:
                lines.append(f"    Recent: \"{msg.get('text', '')[:80]}\"")
    
    lines.append("\nLARGEST FILES:")
    for b in top_loc:
        meta = b.get("metadata", {})
        lines.append(f"  - {b['file_path']} | {meta.get('loc', 0)} lines | {meta.get('language', '')}")
    
    if hotspots:
        lines.append(f"\nHOTSPOTS (high complexity, need refactoring): {len(hotspots)} files")
        for b in hotspots[:5]:
            lines.append(f"  - {b['file_path']}")
    
    if recent:
        lines.append(f"\nRECENTLY MODIFIED (last 7 days): {len(recent)} files")
        for b in recent[:5]:
            churn = b.get("metadata", {}).get("git_churn", {})
            lines.append(f"  - {b['file_path']} | {churn.get('recent_commits', 0)} recent commits")
    
    if churned:
        lines.append(f"\nHIGH CHURN FILES (frequently changed): {len(churned)} files")
        for b in churned[:5]:
            churn = b.get("metadata", {}).get("git_churn", {})
            lines.append(f"  - {b['file_path']} | {churn.get('commit_count', 0)} commits in 1 year")
    
    return "\n".join(lines)


def _find_mentioned_buildings(answer: str, buildings: list) -> list[str]:
    """Find building IDs whose filenames appear in the AI answer."""
    mentioned = []
    answer_lower = answer.lower()
    for b in buildings:
        filename = b["file_path"].replace("\\", "/").split("/")[-1]
        stem = filename.rsplit(".", 1)[0]
        if stem.lower() in answer_lower or filename.lower() in answer_lower:
            mentioned.append(b["id"])
    return mentioned[:6]  # max 6 highlights
