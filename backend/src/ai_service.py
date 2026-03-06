# ai_service.py — Generates AI file summaries via AWS Bedrock Claude 3 Haiku with concurrent execution.

import asyncio
import json

import boto3


AI_CAP = 15
MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0"

PROMPT_TEMPLATE = (
    "You are a senior software architect. In exactly ONE sentence "
    "(max 20 words), describe what this file does architecturally.\n\n"
    "File: {file_path}\n\n{code}"
)


async def enrich_with_ai(files: list[dict]) -> list[dict]:
    """Add ai_summary to each file dict using AWS Bedrock Claude 3 Haiku.

    The first AI_CAP files are summarised concurrently. The rest get a
    placeholder string. Any per-file failure is caught and recorded
    as an error message in ai_summary.

    Args:
        files: List of file dicts (must contain file_path, raw_code).

    Returns:
        The same list, mutated in place with ai_summary added.
    """
    client = boto3.client("bedrock-runtime", region_name="us-east-1")
    loop = asyncio.get_running_loop()

    # Sort by complexity+LOC score — summarise the most architecturally interesting files
    sorted_by_score = sorted(
        files,
        key=lambda f: (f.get("complexity", 0) * 0.6 + f.get("loc", 0) / 50 * 0.4),
        reverse=True,
    )

    to_enrich = sorted_by_score[:AI_CAP]
    remainder = sorted_by_score[AI_CAP:]
    enrich_set = {id(f) for f in to_enrich}

    # Fire all Bedrock calls concurrently
    tasks = [
        loop.run_in_executor(None, _call_bedrock, client, f)
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


def _call_bedrock(client, file_dict: dict) -> str:
    """Synchronous Bedrock invoke for a single file."""
    prompt = PROMPT_TEMPLATE.format(
        file_path=file_dict["file_path"],
        code=file_dict["raw_code"][:3000],
    )

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 80,
        "messages": [{"role": "user", "content": prompt}],
    })

    resp = client.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=body,
    )

    resp_body = json.loads(resp["body"].read())
    return resp_body["content"][0]["text"].strip()
