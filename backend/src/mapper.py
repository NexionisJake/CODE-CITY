# mapper.py — Maps code metrics to 3D building dimensions, colors, and spatial layout positions.

import math
from collections import defaultdict


def build_spatial_layout(files: list[dict]) -> tuple[list[dict], list[dict]]:
    """Convert enriched file dicts into positioned buildings and import roads."""
    if not files:
        return [], []

    n = len(files)

    # Scale spacing dynamically based on repo size
    # Small repo (10 files): tight city feel
    # Large repo (200 files): spread out so roads are readable
    size_factor = math.log10(max(n, 2))  # log scale: 10→1, 100→2, 200→2.3

    BUILDING_GAP = 10.0 + size_factor * 8.0   # ~18 for 10 files, ~28 for 200
    CLUSTER_GAP  = 30.0 + size_factor * 25.0  # ~55 for 10 files, ~88 for 200
    MIN_DIM      = 4.0
    MAX_DIM      = 10.0
    MIN_HEIGHT   = 4.0
    MAX_HEIGHT   = 60.0

    # ── Scale ranges ──────────────────────────────────────────────────────
    locs  = [f["loc"] for f in files]
    funcs = [f["function_count"] for f in files]
    loc_min,  loc_max  = min(locs),  max(locs)
    func_min, func_max = min(funcs), max(funcs)

    # ── Group files by top-level directory ────────────────────────────────
    clusters: dict[str, list[dict]] = defaultdict(list)
    for f in files:
        parts = f["file_path"].replace("\\", "/").split("/")
        if len(parts) >= 3:
            key = parts[1]
        elif len(parts) == 2:
            key = parts[0]
        else:
            key = "__root__"
        clusters[key].append(f)

    buildings = []

    # ── Place clusters side by side along X ───────────────────────────────
    cursor_x = 0.0

    for cluster_key, cluster_files in sorted(clusters.items()):
        grid_cols = math.ceil(math.sqrt(len(cluster_files)))

        dims = []
        for f in cluster_files:
            dim = _scale(f["function_count"], func_min, func_max, MIN_DIM, MAX_DIM)
            dims.append(max(dim, MIN_DIM))

        max_dim_in_cluster = max(dims) if dims else MIN_DIM
        cell_size = max_dim_in_cluster + BUILDING_GAP

        for idx, (f, dim) in enumerate(zip(cluster_files, dims)):
            col = idx % grid_cols
            row = idx // grid_cols

            height = _scale(f["loc"], loc_min, loc_max, MIN_HEIGHT, MAX_HEIGHT)
            color  = _complexity_to_color(f["complexity"])

            x = cursor_x + col * cell_size
            z = row * cell_size

            buildings.append({
                "id":        f["file_path"],
                "file_path": f["file_path"],
                "position":  {"x": x, "y": height / 2, "z": z},
                "dimensions": {"width": dim, "height": height, "depth": dim},
                "color":     color,
                "metadata":  {
                    "language":       f["language"],
                    "loc":            f["loc"],
                    "complexity":     f["complexity"],
                    "function_count": f["function_count"],
                    "ai_summary":     f.get("ai_summary", ""),
                    "is_hotspot":     f["complexity"] > 8,
                },
            })

        cluster_width = grid_cols * cell_size
        cursor_x += cluster_width + CLUSTER_GAP

    # ── Build directed roads from import graph ────────────────────────────
    roads = _build_roads(files)

    return buildings, roads


def _scale(value: float, in_min: float, in_max: float,
           out_min: float, out_max: float) -> float:
    if in_max == in_min:
        return (out_min + out_max) / 2
    t = (value - in_min) / (in_max - in_min)
    return out_min + t * (out_max - out_min)


def _complexity_to_color(complexity: float) -> dict[str, int]:
    if complexity <= 5:
        return {"r": 0, "g": 220, "b": 80}
    elif complexity <= 10:
        t = (complexity - 5) / 5
        return {
            "r": int(0 + t * (220 - 0)),
            "g": int(220 + t * (220 - 220)),
            "b": int(80 + t * (30 - 80)),
        }
    else:
        t = min((complexity - 10) / 10, 1.0)
        return {
            "r": int(220 + t * (220 - 220)),
            "g": int(220 + t * (40 - 220)),
            "b": int(30 + t * (30 - 30)),
        }


def _build_roads(files: list[dict]) -> list[dict]:
    """Match raw_imports to file stems and produce directed road dicts."""
    stem_entries: list[tuple[str, str]] = []
    for f in files:
        fp = f["file_path"]
        base = fp.rsplit(".", 1)[0]
        parts = base.replace("\\", "/").split("/")
        for i in range(len(parts)):
            dotted = ".".join(parts[i:])
            stem_entries.append((dotted, fp))

    seen: set[tuple[str, str]] = set()
    roads: list[dict] = []
    outgoing_count: dict[str, int] = {}
    MAX_OUTGOING = 12  # max roads leaving any single building

    for f in files:
        src = f["file_path"]
        for imp_str in f.get("raw_imports", []):
            if outgoing_count.get(src, 0) >= MAX_OUTGOING:
                break
            for stem, target in stem_entries:
                if target == src:
                    continue
                if stem in imp_str:
                    pair = (src, target)
                    if pair not in seen:
                        seen.add(pair)
                        roads.append({
                            "start_building_id": src,
                            "end_building_id": target,
                            "directed": True,
                        })
                        outgoing_count[src] = outgoing_count.get(src, 0) + 1
                    break

    return roads
