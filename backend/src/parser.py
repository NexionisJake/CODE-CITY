# parser.py — Parses source files into ASTs using tree-sitter for Python and JavaScript/TypeScript.
#              Tier 2 languages get LOC counting and regex-based import extraction.

import os
import re

import tree_sitter_javascript as tsj
import tree_sitter_python as tsp
from tree_sitter import Language, Parser

# ── Tier 1: Tree-sitter supported languages (full AST parsing) ────────────
PY_LANG = Language(tsp.language(), "python")
JS_LANG = Language(tsj.language(), "javascript")

EXTENSION_MAP = {
    ".py":  ("py",  PY_LANG),
    ".js":  ("js",  JS_LANG),
    ".ts":  ("ts",  JS_LANG),
    ".jsx": ("jsx", JS_LANG),
    ".tsx": ("tsx", JS_LANG),
}

PY_IMPORT_QUERY = PY_LANG.query(
    "(import_statement) @imp (import_from_statement) @imp"
)
JS_IMPORT_QUERY = JS_LANG.query("(import_statement) @imp")
JS_REQUIRE_QUERY = JS_LANG.query(
    '(call_expression function: (identifier) @fn (#eq? @fn "require")) @call'
)

# ── Tier 2: Languages we can count LOC for but can't do AST parsing ───────
FALLBACK_EXTENSIONS = {
    # Systems languages
    ".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hxx", ".hh",
    # JVM
    ".java", ".kt", ".kts", ".scala",
    # Go
    ".go",
    # Rust
    ".rs",
    # Ruby
    ".rb", ".rake",
    # PHP
    ".php",
    # Swift / ObjC
    ".swift", ".m", ".mm",
    # Shell
    ".sh", ".bash", ".zsh",
    # Other web
    ".vue", ".svelte",
}

# All extensions we process
ALL_EXTENSIONS = set(EXTENSION_MAP.keys()) | FALLBACK_EXTENSIONS

# ── Directories to skip ───────────────────────────────────────────────────
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", "venv", ".venv",
    "dist", "build", ".next", "out", "target",
    "vendor", "third_party", "thirdparty", "extern",
    ".gradle", ".mvn", "gradle",
    "Pods", ".cocoapods",
    ".tox", ".pytest_cache",
    "coverage", ".nyc_output",
    "__mocks__", "fixtures",
    "migrations",
}

# ── Patterns for generated/minified files to skip ─────────────────────────
_SKIP_PATTERNS = [".min.", ".bundle.", ".generated.", ".pb.", "_pb2.", ".pb.go", "schema.graphql"]

# ── Regex-based import patterns for Tier 2 languages ──────────────────────
_IMPORT_PATTERNS = {
    ".c":     re.compile(r'#include\s+["<]([^">]+)[">]'),
    ".h":     re.compile(r'#include\s+["<]([^">]+)[">]'),
    ".cpp":   re.compile(r'#include\s+["<]([^">]+)[">]'),
    ".cc":    re.compile(r'#include\s+["<]([^">]+)[">]'),
    ".cxx":   re.compile(r'#include\s+["<]([^">]+)[">]'),
    ".hpp":   re.compile(r'#include\s+["<]([^">]+)[">]'),
    ".hxx":   re.compile(r'#include\s+["<]([^">]+)[">]'),
    ".hh":    re.compile(r'#include\s+["<]([^">]+)[">]'),
    ".go":    re.compile(r'import\s+["(]([^")]+)[")]'),
    ".rs":    re.compile(r'(?:use|extern crate)\s+([\w:]+)'),
    ".java":  re.compile(r'import\s+([\w.]+)'),
    ".kt":    re.compile(r'import\s+([\w.]+)'),
    ".kts":   re.compile(r'import\s+([\w.]+)'),
    ".scala": re.compile(r'import\s+([\w.]+)'),
    ".rb":    re.compile(r"require(?:_relative)?\s+['\"]([^'\"]+)['\"]"),
    ".rake":  re.compile(r"require(?:_relative)?\s+['\"]([^'\"]+)['\"]"),
    ".php":   re.compile(r"(?:use|require|include)\s+['\"]?([\w\\./]+)['\"]?"),
    ".swift": re.compile(r'import\s+(\w+)'),
    ".m":     re.compile(r'#import\s+["<]([^">]+)[">]'),
    ".mm":    re.compile(r'#import\s+["<]([^">]+)[">]'),
}


def parse_repo(root_dir: str) -> list[dict]:
    """Walk a repository directory, parse supported files, and extract imports."""
    parser = Parser()
    results = []

    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Prune skip dirs in-place
        dirnames[:] = [
            d for d in dirnames
            if d not in SKIP_DIRS and not d.startswith(".")
        ]

        for fname in filenames:
            ext = os.path.splitext(fname)[1].lower()
            if ext not in ALL_EXTENSIONS:
                continue

            abs_path = os.path.join(dirpath, fname)
            rel_path = os.path.relpath(abs_path, root_dir).replace("\\", "/")

            # Skip generated/minified files
            if any(pat in fname for pat in _SKIP_PATTERNS):
                continue

            try:
                with open(abs_path, "rb") as fh:
                    code_bytes = fh.read()

                # Skip binary files (null bytes in first 1KB)
                if b"\x00" in code_bytes[:1024]:
                    continue

                code_str = code_bytes.decode("utf-8", errors="ignore")

                # Tier 1: full Tree-sitter AST parsing
                if ext in EXTENSION_MAP:
                    lang_key, lang_obj = EXTENSION_MAP[ext]
                    parser.set_language(lang_obj)
                    tree = parser.parse(code_bytes)
                    raw_imports = _extract_imports_treesitter(tree, lang_key)
                # Tier 2: regex-based import extraction
                else:
                    lang_key = ext.lstrip(".")
                    raw_imports = _extract_imports_regex(code_str, ext)

                results.append({
                    "file_path":   rel_path,
                    "abs_path":    abs_path,
                    "language":    lang_key,
                    "raw_code":    code_str,
                    "raw_imports": raw_imports,
                })

            except Exception:
                continue

    return results


def _read_file(path: str) -> bytes | None:
    try:
        with open(path, "rb") as f:
            return f.read()
    except (OSError, IOError):
        return None


def _extract_imports_treesitter(tree, lang_key: str) -> list[str]:
    """Extract imports using Tree-sitter queries (Tier 1)."""
    imports = []
    root = tree.root_node

    if lang_key == "py":
        for node, _ in PY_IMPORT_QUERY.captures(root):
            imports.append(node.text.decode("utf-8", errors="replace"))
    else:
        for node, _ in JS_IMPORT_QUERY.captures(root):
            imports.append(node.text.decode("utf-8", errors="replace"))
        for node, name in JS_REQUIRE_QUERY.captures(root):
            if name == "call":
                imports.append(node.text.decode("utf-8", errors="replace"))

    return imports


def _extract_imports_regex(code: str, ext: str) -> list[str]:
    """Extract imports using regex patterns (Tier 2)."""
    pattern = _IMPORT_PATTERNS.get(ext)
    if not pattern:
        return []
    return [m.group(0) for m in pattern.finditer(code)][:50]
