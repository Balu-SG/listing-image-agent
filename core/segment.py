"""Product / background segmentation.

U^2-Net-p (salient object detection) through cv2.dnn, with a colour-distance
fallback for plain light backgrounds.
"""

import cv2
import numpy as np

from core import models

U2NET_SIZE = 320
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


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
    """Foreground = pixels noticeably darker than white. Only valid on light backgrounds."""
    distance = 255 - image.min(axis=2).astype(np.int16)
    mask = np.where(distance > white_tolerance, 255, 0).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    return cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)


def _is_frame(stats_row: np.ndarray, height: int, width: int) -> bool:
    """A thin ring spanning the whole image is a border, not a product."""
    spans_image = stats_row[cv2.CC_STAT_WIDTH] >= width - 2 and stats_row[cv2.CC_STAT_HEIGHT] >= height - 2
    return spans_image and stats_row[cv2.CC_STAT_AREA] < 0.3 * height * width


def keep_main_components(mask: np.ndarray, min_share: float = 0.02) -> np.ndarray:
    """Drop borders and specks: keep components at least min_share of the largest (multi-piece products survive)."""
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if count <= 1:
        return mask
    height, width = mask.shape
    areas = np.array([0 if _is_frame(row, height, width) else row[cv2.CC_STAT_AREA] for row in stats[1:]])
    if areas.max() == 0:
        return np.zeros_like(mask)
    keep_ids = np.flatnonzero((areas > 0) & (areas >= areas.max() * min_share)) + 1
    return np.where(np.isin(labels, keep_ids), 255, 0).astype(np.uint8)


def protect_mask(image: np.ndarray, mask: np.ndarray, reach_share: float = 0.04) -> np.ndarray:
    """Conservative superset of the product that fixes must never touch.

    U^2-Net misses thin parts (ear loops, cables, straps) and leaves soft shadows out. Any
    non-white pixel within reach of the product mask is protected too. Pixels further away
    (a grey backdrop, a badge in the corner) stay unprotected, so they are still judged.
    """
    reach = max(3, int(max(mask.shape) * reach_share))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * reach + 1, 2 * reach + 1))
    near_product = cv2.dilate(mask, kernel) > 0
    non_white = segment_threshold(image, white_tolerance=6) > 0
    return np.where((mask > 0) | (near_product & non_white), 255, 0).astype(np.uint8)


def segment_product(image: np.ndarray, method: str = "auto") -> np.ndarray:
    if method == "threshold":
        mask = segment_threshold(image)
    else:
        mask = segment_u2net(image)
        if method == "auto" and mask.mean() / 255 < 0.005:
            mask = segment_threshold(image)
    return keep_main_components(mask)
