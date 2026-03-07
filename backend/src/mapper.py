# mapper.py — Maps code metrics to 3D building dimensions, colors, and spatial layout positions.

import math
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional

# ─── Squarified Treemap Implementation ────────────────────────────────────────

@dataclass
class Rect:
    x: float
    z: float
    w: float  # width  (X axis)
    d: float  # depth  (Z axis)

    @property
    def area(self):
        return self.w * self.d

    @property
    def shorter_side(self):
        return min(self.w, self.d)

def _squarify(weights: list[float], total: float, rect: Rect) -> list[Rect]:
    if not weights:
        return []
    if len(weights) == 1:
        return [Rect(rect.x, rect.z, rect.w, rect.d)]

    results: list[Rect] = []
    remaining = list(weights)
    remaining_rect = Rect(rect.x, rect.z, rect.w, rect.d)
    remaining_total = total

    while len(remaining) > 1:
        row, remaining = _layout_row(remaining, remaining_total, remaining_rect)
        row_area = sum(w / remaining_total * remaining_rect.area for w in row)

        if remaining_rect.w >= remaining_rect.d:
            strip_w = row_area / remaining_rect.d
            strip_rect = Rect(remaining_rect.x, remaining_rect.z, strip_w, remaining_rect.d)
            results.extend(_divide_strip(row, strip_rect, axis="z"))
            remaining_rect = Rect(
                remaining_rect.x + strip_w,
                remaining_rect.z,
                remaining_rect.w - strip_w,
                remaining_rect.d,
            )
        else:
            strip_d = row_area / remaining_rect.w
            strip_rect = Rect(remaining_rect.x, remaining_rect.z, remaining_rect.w, strip_d)
            results.extend(_divide_strip(row, strip_rect, axis="x"))
            remaining_rect = Rect(
                remaining_rect.x,
                remaining_rect.z + strip_d,
                remaining_rect.w,
                remaining_rect.d - strip_d,
            )

        remaining_total -= sum(row)

    results.append(remaining_rect)
    return results

def _layout_row(weights: list[float], total: float, rect: Rect) -> tuple[list[float], list[float]]:
    row: list[float] = []
    for i, w in enumerate(weights):
        candidate = row + [w]
        if row and _worst_ratio(candidate, total, rect) > _worst_ratio(row, total, rect):
            return row, weights[i:]
        row = candidate
    return row, []

def _worst_ratio(row: list[float], total: float, rect: Rect) -> float:
    s = sum(row)
    area_fraction = s / total
    side = rect.shorter_side
    row_area = area_fraction * rect.area
    row_side = row_area / side if side > 0 else 1
    ratios = [(side * side * w / (s * s)) if s > 0 else 1 for w in row]
    return max(max(r, 1 / r) for r in ratios) if ratios else float("inf")

def _divide_strip(row: list[float], strip: Rect, axis: str) -> list[Rect]:
    total = sum(row)
    results = []
    cursor = strip.z if axis == "z" else strip.x
    for w in row:
        frac = w / total if total > 0 else 1 / len(row)
        if axis == "z":
            cell = Rect(strip.x, cursor, strip.w, strip.d * frac)
            cursor += strip.d * frac
        else:
            cell = Rect(cursor, strip.z, strip.w * frac, strip.d)
            cursor += strip.w * frac
        results.append(cell)
    return results
# ─── Spacing / sizing constants ────────────────────────────────────────────────
CANVAS_SIZE   = 400.0   # total city footprint (world units, both X and Z)
DISTRICT_PAD  = 12.0    # padding inside each district rectangle
BUILDING_GAP  = 4.0     # gap between buildings within a district
MIN_DIM       = 6.0     # minimum building footprint
MAX_DIM       = 16.0    # maximum building footprint
MIN_HEIGHT    = 6.0
MAX_HEIGHT    = 70.0


def build_spatial_layout(files: list[dict]) -> tuple[list[dict], list[dict]]:
    """Convert enriched file dicts into positioned buildings and import roads."""
    if not files:
        return [], []

    from collections import defaultdict

    # ── 1. Group files by top-level directory ─────────────────────────────────
    clusters: dict[str, list[dict]] = defaultdict(list)
    for f in files:
        parts = f["file_path"].replace("\\", "/").split("/")
        key = parts[1] if len(parts) >= 3 else parts[0] if len(parts) == 2 else "__root__"
        clusters[key].append(f)

    cluster_keys    = list(clusters.keys())
    
    # NEW: blend file count and LOC — gives each district a fairer size
    cluster_weights = [
        max(
            len(clusters[k]) * 40 +
            sum(f["loc"] for f in clusters[k]) * 0.1,
            1
        )
        for k in cluster_keys
    ]
    total_weight = sum(cluster_weights)

    # ── 2. Treemap: partition CANVAS_SIZE × CANVAS_SIZE among districts ───────
    root_rect = Rect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    district_rects = _squarify(cluster_weights, total_weight, root_rect)

    # ── 3. Place buildings inside each district ───────────────────────────────
    locs  = [f["loc"]            for f in files]
    funcs = [f["function_count"] for f in files]
    loc_min,  loc_max  = min(locs),  max(locs)
    func_min, func_max = min(funcs), max(funcs)

    buildings: list[dict] = []
    district_meta: dict[str, dict] = {}   # key → {rect, color}

    for key, drect in zip(cluster_keys, district_rects):
        group = clusters[key]

        # Usable area inside the district (after padding)
        inner_x = drect.x + DISTRICT_PAD
        inner_z = drect.z + DISTRICT_PAD
        inner_w = max(drect.w - DISTRICT_PAD * 2, 1)
        inner_d = max(drect.d - DISTRICT_PAD * 2, 1)

        # Grid layout inside the district
        n_cols = max(1, math.floor(math.sqrt(len(group) * inner_w / max(inner_d, 1))))
        n_rows = math.ceil(len(group) / n_cols)
        cell_w = inner_w / n_cols
        cell_d = inner_d / n_rows

        # Assign a district color (cycle through palette)
        dist_idx = cluster_keys.index(key)
        district_palette = [
            (0.27, 0.40, 0.67),  # blue
            (0.67, 0.27, 0.27),  # red
            (0.27, 0.67, 0.40),  # green
            (0.67, 0.60, 0.27),  # gold
            (0.67, 0.40, 0.27),  # orange
            (0.40, 0.27, 0.67),  # purple
            (0.27, 0.60, 0.67),  # teal
            (0.67, 0.27, 0.60),  # pink
        ]
        dr, dg, db = district_palette[dist_idx % len(district_palette)]

        district_meta[key] = {
            "rect": {"x": drect.x, "z": drect.z, "w": drect.w, "d": drect.d},
            "color": {"r": dr, "g": dg, "b": db},
            "label": key,
        }

        for idx, f in enumerate(group):
            col = idx % n_cols
            row = idx // n_cols

            dim    = _scale(f["function_count"], func_min, func_max, MIN_DIM, MAX_DIM)
            height = _scale(f["loc"], loc_min, loc_max, MIN_HEIGHT, MAX_HEIGHT)
            color  = _complexity_to_color(f["complexity"])

            # Center building in its cell
            x = inner_x + col * cell_w + cell_w / 2
            z = inner_z + row * cell_d + cell_d / 2

            buildings.append({
                "id":        f["file_path"],
                "file_path": f["file_path"],
                "position":  {"x": x, "y": height / 2, "z": z},
                "dimensions": {"width": dim, "height": height, "depth": dim},
                "color":     color,
                "district":  key,
                "metadata":  {
                    "language":       f["language"],
                    "loc":            f["loc"],
                    "complexity":     f["complexity"],
                    "function_count": f["function_count"],
                    "ai_summary":     f.get("ai_summary", ""),
                    "is_hotspot":     f["complexity"] > 8,
                    "social": f.get("social", {
                        "heat_score":      0.0,
                        "message_count":   0,
                        "recent_messages": [],
                        "is_hotspot":      False,
                    }),
                },
            })

    # ── 4. Build directed roads ────────────────────────────────────────────────
    file_set = {f["file_path"] for f in files}

    # Build lookup: stem → file_path for fast matching
    # Strip repo root prefix from paths for matching
    # e.g. "zulip-terminal-main/zulip_terminal/utils.py"
    #   → stem: "zulip_terminal.utils"
    stem_to_path: dict[str, str] = {}
    for fp in file_set:
        # Remove repo root folder prefix (first path component)
        parts = fp.replace("\\", "/").split("/")
        # Skip first component (repo-name-main/) for matching
        inner_parts = parts[1:] if len(parts) > 1 else parts
        # Build dotted stem: "zulip_terminal/utils.py" → "zulip_terminal.utils"
        stem = ".".join(inner_parts).rsplit(".", 1)[0]
        stem_to_path[stem] = fp
        # Also add just the filename stem for simple imports like "import utils"
        filename_stem = inner_parts[-1].rsplit(".", 1)[0] if inner_parts else ""
        if filename_stem and filename_stem not in stem_to_path:
            stem_to_path[filename_stem] = fp

    roads: list[dict] = []
    seen:  set[tuple] = set()
    outgoing: dict[str, int] = {}
    MAX_OUTGOING = 12

    for f in files:
        src = f["file_path"]
        for raw_import in f.get("raw_imports", []):
            if outgoing.get(src, 0) >= MAX_OUTGOING:
                break

            # Try to match the import string against known stems
            matched_path = None

            # Direct stem lookup
            for stem, path in stem_to_path.items():
                if path == src:
                    continue
                # Check if the import contains this stem
                # Use word-boundary style matching to avoid false positives
                if stem in raw_import or raw_import.endswith(stem):
                    matched_path = path
                    break

            if matched_path:
                key = (src, matched_path)
                if key not in seen:
                    seen.add(key)

                    # Check if cross-district
                    src_district  = next((b["district"] for b in buildings if b["id"] == src), "")
                    dst_district  = next((b["district"] for b in buildings if b["id"] == matched_path), "")

                    roads.append({
                        "start_building_id": src,
                        "end_building_id":   matched_path,
                        "directed":          True,
                        "cross_district":    src_district != dst_district,
                    })
                    outgoing[src] = outgoing.get(src, 0) + 1

    print(f"[mapper] Generated {len(roads)} roads from {len(files)} files")

    # ── 5. Attach district metadata to response ────────────────────────────────
    # Store on each building so the frontend can draw district patches
    for b in buildings:
        b["district_meta"] = district_meta.get(b["district"], {})

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


