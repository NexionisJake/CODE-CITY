# ai_service.py — Generates AI file summaries via AWS Bedrock Claude 3 Haiku with concurrent execution.

import asyncio
from src.llm_service import build_summary_chain

AI_CAP = 15
_summary_chain = build_summary_chain()


async def enrich_with_ai(files: list[dict]) -> list[dict]:
    """Add ai_summary to each file dict using LangChain.

    The first AI_CAP files are summarised concurrently. The rest get a
    placeholder string. Any per-file failure is caught and recorded
    as an error message in ai_summary.

    Args:
        files: List of file dicts (must contain file_path, raw_code).

    Returns:
        The same list, mutated in place with ai_summary added.
    """
    # Sort by complexity+LOC score — summarise the most architecturally interesting files
    sorted_by_score = sorted(
        files,
        key=lambda f: (f.get("complexity", 0) * 0.6 + f.get("loc", 0) / 50 * 0.4),
        reverse=True,
    )

    to_enrich = sorted_by_score[:AI_CAP]
    remainder = sorted_by_score[AI_CAP:]

    # Fire all LangChain ainvoke calls concurrently
    tasks = [
        _summarise_file(f)
        for f in to_enrich
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for f, result in zip(to_enrich, results):
        if isinstance(result, Exception):
            f["ai_summary"] = f"AI error: {result}"
        else:
            f["ai_summary"] = result

    for f in remainder:
        f["ai_summary"] = "Summary not generated — this file ranked outside the top 15 by complexity."

    return files


async def _summarise_file(f: dict) -> str:
    history = f.get("github_history", {})
    commit_context = ""
    if history.get("why_summary"):
        commit_context = f"Recent commit context: {history['why_summary']}"
    
    try:
        # Use LangChain chain instead of direct Bedrock call
        result = await _summary_chain.ainvoke({
            "file_path":      f["file_path"],
            "language":       f.get("language", ""),
            "loc":            f.get("loc", 0),
            "complexity":     f.get("complexity", 0.0),
            "function_count": f.get("function_count", 0),
            "commit_context": commit_context,
            "code_snippet":   f["raw_code"][:2000],
        })
        return result.strip()
    except Exception as e:
        return f"Summary unavailable: {e}"
