# metrics.py — Calculates code metrics (LOC, cyclomatic complexity, function count).
#              Uses Radon for Python, regex heuristics for all other languages.

import re

from radon.raw import analyze
from radon.visitors import ComplexityVisitor


def calculate_metrics(parsed_files: list[dict]) -> list[dict]:
    """Add loc, complexity, and function_count to each parsed file dict."""
    for f in parsed_files:
        code = f["raw_code"]
        lang = f["language"]

        # ── LOC ──────────────────────────────────────────────────────────
        if lang == "py":
            try:
                raw = analyze(code)
                loc = max(raw.lloc, 1)
            except Exception:
                loc = _count_loc_basic(code)
        else:
            loc = _count_loc_basic(code)

        # ── Complexity & function count ───────────────────────────────────
        if lang == "py":
            try:
                blocks = ComplexityVisitor.from_code(code).blocks
                if blocks:
                    complexity     = round(sum(b.complexity for b in blocks) / len(blocks), 2)
                    function_count = len(blocks)
                else:
                    complexity     = 1.0
                    function_count = 0
            except Exception:
                complexity, function_count = _estimate_complexity(code, lang)
        else:
            complexity, function_count = _estimate_complexity(code, lang)

        f["loc"]            = loc
        f["complexity"]     = complexity
        f["function_count"] = function_count

    return parsed_files


def _count_loc_basic(code: str) -> int:
    """Count non-blank, non-comment lines for any language."""
    count = 0
    in_block_comment = False
    for line in code.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        # C-style block comment toggle (rough)
        if "/*" in stripped:
            in_block_comment = True
        if "*/" in stripped:
            in_block_comment = False
            continue
        if in_block_comment:
            continue
        # Single-line comments
        if stripped.startswith(("//", "#", "--", "/*", "*", "<!--")):
            continue
        count += 1
    return max(count, 1)


def _estimate_complexity(code: str, lang: str) -> tuple[float, int]:
    """
    Estimate cyclomatic complexity and function count via regex for non-Python files.
    Counts branch keywords and function definitions.
    """
    # Count branch keywords (each adds 1 to complexity)
    branch_pattern = re.compile(
        r'\b(if|else|elif|for|while|switch|case|catch|except|&&|\|\|)\b'
    )
    branches = len(branch_pattern.findall(code))

    # Count function/method definitions per language
    func_patterns = {
        "js":    re.compile(r'\bfunction\s+\w+|\b\w+\s*=\s*(?:async\s*)?\(.*?\)\s*=>'),
        "ts":    re.compile(r'\bfunction\s+\w+|\b\w+\s*=\s*(?:async\s*)?\(.*?\)\s*=>'),
        "jsx":   re.compile(r'\bfunction\s+\w+|\b\w+\s*=\s*(?:async\s*)?\(.*?\)\s*=>'),
        "tsx":   re.compile(r'\bfunction\s+\w+|\b\w+\s*=\s*(?:async\s*)?\(.*?\)\s*=>'),
        "java":  re.compile(r'(?:public|private|protected|static)\s+\w+\s+\w+\s*\('),
        "kt":    re.compile(r'\bfun\s+\w+\s*\('),
        "kts":   re.compile(r'\bfun\s+\w+\s*\('),
        "go":    re.compile(r'\bfunc\s+\w+\s*\('),
        "rs":    re.compile(r'\bfn\s+\w+\s*\('),
        "c":     re.compile(r'^\w[\w\s\*]+\w\s*\([^;]*\)\s*\{', re.MULTILINE),
        "h":     re.compile(r'^\w[\w\s\*]+\w\s*\([^;]*\)\s*\{', re.MULTILINE),
        "cpp":   re.compile(r'^\w[\w\s\*:~]+\w\s*\([^;]*\)\s*\{', re.MULTILINE),
        "cc":    re.compile(r'^\w[\w\s\*:~]+\w\s*\([^;]*\)\s*\{', re.MULTILINE),
        "cxx":   re.compile(r'^\w[\w\s\*:~]+\w\s*\([^;]*\)\s*\{', re.MULTILINE),
        "hpp":   re.compile(r'^\w[\w\s\*:~]+\w\s*\([^;]*\)\s*\{', re.MULTILINE),
        "rb":    re.compile(r'\bdef\s+\w+'),
        "rake":  re.compile(r'\bdef\s+\w+'),
        "php":   re.compile(r'\bfunction\s+\w+\s*\('),
        "swift": re.compile(r'\bfunc\s+\w+\s*\('),
        "scala": re.compile(r'\bdef\s+\w+\s*[\[(]'),
        "m":     re.compile(r'^[-+]\s*\(', re.MULTILINE),
        "mm":    re.compile(r'^[-+]\s*\(', re.MULTILINE),
        "sh":    re.compile(r'^\w+\s*\(\)\s*\{', re.MULTILINE),
        "bash":  re.compile(r'^\w+\s*\(\)\s*\{', re.MULTILINE),
    }

    pattern = func_patterns.get(lang)
    function_count = len(pattern.findall(code)) if pattern else 0

    # Complexity = 1 (base) + branches / functions (avg per function)
    if function_count > 0:
        complexity = round(1.0 + branches / function_count, 2)
    else:
        complexity = round(1.0 + min(branches * 0.1, 10.0), 2)

    return min(complexity, 25.0), function_count
