"""Product / background segmentation.

Two modes, chosen per image:

- studio: the background is a plain backdrop. It is found by flood-filling inward from the image
  edges in small colour steps, which follows soft shadows and gradients but stops at the product's
  outline. Everything the flood cannot reach is product, so printed labels, thin straps and holes
  inside the product are all kept. This is the only mode in which the background may be edited.
- scene: the flood cannot find a plain backdrop (lifestyle photo). U^2-Net-p (salient object
  detection through cv2.dnn) locates the product for measuring, but the background is not edited:
  guessing what to erase in a scene could remove part of the product.
"""

import cv2
import numpy as np

from core import models

U2NET_SIZE = 320
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

FLOOD_STEP = 3              # max colour step between neighbouring background pixels
STUDIO_MIN_SHARE = 0.08     # backdrop must cover at least this much of the frame
STUDIO_MAX_STD = 28         # and be fairly uniform in brightness
MIN_PIECE_SHARE = 0.0015    # product pieces smaller than this share of the frame are noise
MIN_PRODUCT_SHARE = 0.01    # less product than this = segmentation failed; nothing may be edited
EDGE_LOW, EDGE_HIGH = 8, 24  # low Canny thresholds: faint outlines must still stop the flood


def segment_u2net(image: np.ndarray) -> np.ndarray:
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (U2NET_SIZE, U2NET_SIZE), interpolation=cv2.INTER_AREA).astype(np.float32)
    normalised = (resized / max(resized.max(), 1.0) - IMAGENET_MEAN) / IMAGENET_STD
    blob = normalised.transpose(2, 0, 1)[np.newaxis].copy()

    net = models.u2netp()
    net.setInput(blob)
    saliency = net.forward()[0, 0]
    saliency = (saliency - saliency.min()) / max(saliency.max() - saliency.min(), 1e-6)
    saliency = cv2.resize(saliency, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_LINEAR)
    return np.where(saliency >= 0.5, 255, 0).astype(np.uint8)


def segment_threshold(image: np.ndarray, white_tolerance: int = 12) -> np.ndarray:
    """Pixels noticeably darker than white. Only meaningful on light backgrounds."""
    distance = 255 - image.min(axis=2).astype(np.int16)
    mask = np.where(distance > white_tolerance, 255, 0).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    return cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)


def background_flood(image: np.ndarray, step: int = FLOOD_STEP, seed_tolerance: int = 16) -> np.ndarray:
    """Boolean background: everything reachable from the image edges in small colour steps."""
    height, width = image.shape[:2]
    blurred = cv2.GaussianBlur(image, (3, 3), 0)  # JPEG noise would otherwise stop the flood
    flood = np.zeros((height + 2, width + 2), np.uint8)
    # Edges are walls: a product's outline stops the flood even where its colour is close to the
    # backdrop (a cream label, a white product). Smooth backdrops and soft shadows have no edges.
    edges = cv2.Canny(cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY), EDGE_LOW, EDGE_HIGH)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8))
    flood[1:-1, 1:-1][edges > 0] = 1  # floodFill never enters non-zero mask pixels
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
    spacing = max(1, min(height, width) // 100)
    seeds = (
        [(x, 0) for x in range(0, width, spacing)] + [(x, height - 1) for x in range(0, width, spacing)]
        + [(0, y) for y in range(0, height, spacing)] + [(width - 1, y) for y in range(0, height, spacing)]
    )
    # Seed only from edge pixels that look like the backdrop: a product touching the edge is not a seed.
    edge_colours = np.array([blurred[y, x] for x, y in seeds], dtype=np.int16)
    backdrop = np.median(edge_colours, axis=0)
    for (x, y), colour in zip(seeds, edge_colours):
        if np.abs(colour - backdrop).max() > seed_tolerance:
            continue
        if not flood[y + 1, x + 1]:
            cv2.floodFill(blurred, flood, (x, y), 0, (step,) * 3, (step,) * 3, flags)
    return flood[1:-1, 1:-1] == 255


def keep_pieces(mask: np.ndarray, min_share: float = MIN_PIECE_SHARE) -> np.ndarray:
    """Drop specks and thin frames that span the whole image (a border is not a product)."""
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    height, width = mask.shape
    keep = []
    for label in range(1, count):
        x, y, w, h, area = stats[label]
        is_frame = w >= width - 2 and h >= height - 2 and area < 0.3 * height * width
        if area >= min_share * height * width and not is_frame:
            keep.append(label)
    return np.where(np.isin(labels, keep), 255, 0).astype(np.uint8)


def _fill_holes(mask: np.ndarray) -> np.ndarray:
    """Holes in a U^2-Net blob are product interior for measuring purposes."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(mask)
    cv2.drawContours(filled, contours, -1, 255, cv2.FILLED)
    return filled


def segment_product(image: np.ndarray, method: str = "auto") -> tuple[np.ndarray, str]:
    """Returns (mask uint8 0/255, mode "studio" | "scene")."""
    if method in ("auto", "flood"):
        background = background_flood(image)
        luma = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)[background]
        share, spread = background.mean(), (luma.std() if luma.size else 255.0)
        # a large, fairly even backdrop, or a thin but perfectly even one (product filling the frame)
        plain = (share >= STUDIO_MIN_SHARE and spread <= STUDIO_MAX_STD) or (share >= 0.01 and spread <= 4)
        if plain or method == "flood":
            mask = keep_pieces(np.where(background, 0, 255).astype(np.uint8))
            if mask.mean() / 255 >= MIN_PRODUCT_SHARE:
                return mask, "studio"
    return keep_pieces(_fill_holes(segment_u2net(image))), "scene"


def protect_mask(image: np.ndarray, mask: np.ndarray, mode: str, reach_share: float = 0.04) -> np.ndarray:
    """Pixels no fix may touch.

    studio: the product plus a 2px rim (anti-aliased edge pixels).
    scene: the product plus any non-white pixel near it (U^2-Net misses thin parts); in practice
    the background of a scene is never edited anyway.
    """
    rim = cv2.dilate(mask, np.ones((5, 5), np.uint8))
    if mode == "studio":
        return rim
    reach = max(3, int(max(mask.shape) * reach_share))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * reach + 1, 2 * reach + 1))
    near_product = cv2.dilate(mask, kernel) > 0
    non_white = segment_threshold(image, white_tolerance=6) > 0
    return np.where((rim > 0) | (near_product & non_white), 255, 0).astype(np.uint8)


def split_text_overlays(mask: np.ndarray, boxes: list[np.ndarray], min_cover: float = 0.4) -> tuple[np.ndarray, list[int]]:
    """Separate pieces that are mostly text (a badge or watermark on the backdrop) are overlays.

    The largest piece is always product; a product with printed text is covered by text over a
    small share of its area. Returns (mask without overlays, labels of the overlay pieces).
    """
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if count <= 2 or not boxes:
        return mask, []
    text = np.zeros_like(mask)
    for box in boxes:
        cv2.fillPoly(text, [box], 255)
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    contours, _ = cv2.findContours(np.where(labels == largest, 255, 0).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hull = cv2.convexHull(np.vstack(contours))
    overlays = []
    for label in range(1, count):
        if label == largest:
            continue
        x, y, w, h, _ = stats[label]
        # Text inside the main product's outline is printed on it, never an overlay.
        if cv2.pointPolygonTest(hull, (float(x + w / 2), float(y + h / 2)), False) >= 0:
            continue
        cover = float((text[y:y + h, x:x + w] > 0).mean())
        if cover >= min_cover:
            overlays.append(label)
    cleaned = mask.copy()
    cleaned[np.isin(labels, overlays)] = 0
    return cleaned, overlays
