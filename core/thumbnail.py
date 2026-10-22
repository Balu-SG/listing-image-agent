"""Search-result visibility: how much the product stands out as a thumbnail among neighbours.

The image is shrunk to a mobile search tile and placed in the centre of a 3x3 grid of fixed
neighbour products (ABO, CC BY 4.0). Spectral-residual saliency estimates where the eye goes;
the score is the centre tile's share of saliency against an even share. 50 = average, 100 = draws
twice its share or more.
"""

from functools import cache
from pathlib import Path

import cv2
import numpy as np

TILE = 160
GUTTER = 12
NEIGHBOR_DIR = Path(__file__).resolve().parent.parent / "assets" / "neighbors"


def to_tile(image: np.ndarray, size: int = TILE) -> np.ndarray:
    scale = size / max(image.shape[:2])
    small = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    tile = np.full((size, size, 3), 255, np.uint8)
    y0, x0 = (size - small.shape[0]) // 2, (size - small.shape[1]) // 2
    tile[y0:y0 + small.shape[0], x0:x0 + small.shape[1]] = small
    return tile


@cache
def neighbor_tiles() -> tuple[np.ndarray, ...]:
    paths = sorted(NEIGHBOR_DIR.glob("*.jpg"))[:8]
    if len(paths) < 8:
        raise FileNotFoundError(f"need 8 neighbour images in {NEIGHBOR_DIR}")
    return tuple(to_tile(cv2.imread(str(path))) for path in paths)


def build_grid(image: np.ndarray) -> np.ndarray:
    tiles = list(neighbor_tiles())
    tiles.insert(4, to_tile(image))
    side = 3 * TILE + 4 * GUTTER
    grid = np.full((side, side, 3), 255, np.uint8)
    for index, tile in enumerate(tiles):
        row, col = divmod(index, 3)
        y0, x0 = GUTTER + row * (TILE + GUTTER), GUTTER + col * (TILE + GUTTER)
        grid[y0:y0 + TILE, x0:x0 + TILE] = tile
    return grid


def visibility(image: np.ndarray) -> dict:
    """Returns score (0-100) plus the grid and a saliency heat map (BGR images) for display."""
    grid = build_grid(image)
    saliency = cv2.saliency.StaticSaliencySpectralResidual_create()
    ok, heat = saliency.computeSaliency(grid)
    if not ok:
        raise RuntimeError("saliency failed")
    heat = cv2.GaussianBlur(heat.astype(np.float32), (0, 0), 3)
    centre = GUTTER + TILE + GUTTER
    centre_share = float(heat[centre:centre + TILE, centre:centre + TILE].sum() / max(heat.sum(), 1e-9))
    ratio = centre_share * 9  # 1.0 = an even share across the 9 tiles
    score = int(round(min(100.0, 50.0 * ratio)))

    normalised = cv2.normalize(heat, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    heat_map = cv2.addWeighted(grid, 0.45, cv2.applyColorMap(normalised, cv2.COLORMAP_INFERNO), 0.55, 0)
    cv2.rectangle(heat_map, (centre - 3, centre - 3), (centre + TILE + 2, centre + TILE + 2), (255, 255, 255), 2)
    return {"score": score, "centre_share": round(centre_share, 4), "grid": grid, "heat_map": heat_map}
