"""
LangChain orchestration layer for all AI operations.
Centralizes model configuration, prompt templates, and chain composition.
"""

import os
from langchain_aws import ChatBedrock
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser


# ─── Model Configuration ──────────────────────────────────────────────────────
def get_llm(max_tokens: int = 500):
    """Get the configured LangChain LLM (Claude via Bedrock)."""
    return ChatBedrock(
        model_id="anthropic.claude-3-haiku-20240307-v1:0",
        region_name=os.getenv("AWS_DEFAULT_REGION", "us-east-1"),
        model_kwargs={
            "max_tokens": max_tokens,
            "temperature": 0.3,
        },
    )


# ─── Prompt Templates ─────────────────────────────────────────────────────────

FILE_SUMMARY_PROMPT = ChatPromptTemplate.from_template("""
You are a senior developer summarizing a source file for a code visualization tool.

File: {file_path}
Language: {language}
Lines of Code: {loc}
Complexity Score: {complexity}
Functions: {function_count}
{commit_context}

Code (first 2000 chars):
{code_snippet}

Write 2-3 sentences explaining:
1. What this file does (its purpose in the system)
2. Why it's architecturally significant
3. What a new developer should know before modifying it

Be specific. Mention actual function names or patterns you observe.
""")

CITY_QUERY_PROMPT = ChatPromptTemplate.from_template("""
You are CodeCity AI — an expert assistant for understanding codebases through 3D visualization.

CODEBASE CONTEXT:
{context}

DEVELOPER QUESTION:
{question}

Answer directly and specifically. Mention actual filenames. Keep under 200 words.
End with 1-2 actionable recommendations.
""")

SHERPA_QUEST_PROMPT = ChatPromptTemplate.from_template("""
You are Sherpa, an AI guide creating a tour of a codebase for developers.

Quest: {quest_title}
Goal: {quest_goal}

Codebase:
{city_summary}

Generate a 4-6 stop tour as JSON with this schema:
{{
  "title": "{quest_title}",
  "description": "what this tour reveals",
  "steps": [{{"building_id": "...", "building_name": "...", "order": 1, "narration": "...", "focus": "..."}}]
}}

building_id must exactly match a file_path from the codebase list.
""")


# ─── Chains ───────────────────────────────────────────────────────────────────

def build_summary_chain():
    """Chain: file metadata → Claude → summary string."""
    llm = get_llm(max_tokens=300)
    return FILE_SUMMARY_PROMPT | llm | StrOutputParser()


def build_query_chain():
    """Chain: question + context → Claude → answer string."""
    llm = get_llm(max_tokens=400)
    return CITY_QUERY_PROMPT | llm | StrOutputParser()


def build_sherpa_chain():
    """Chain: quest params → Claude → JSON quest."""
    llm = get_llm(max_tokens=1500)
    return SHERPA_QUEST_PROMPT | llm | StrOutputParser()
