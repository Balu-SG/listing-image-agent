"""Run a rule pack on one image: segmentation once, then every rule, then a weighted score."""

from functools import cache
from pathlib import Path

import cv2
import numpy as np
import yaml

from core.rules import ALL_RULES, border_band, detect_text, find_border
from core.segment import protect_mask, segment_product, split_text_overlays
from core.types import Context, Status

RULEPACK_DIR = Path(__file__).resolve().parent / "rulepacks"
STATUS_POINTS = {Status.PASS: 1.0, Status.FIXABLE: 0.5, Status.RESHOOT: 0.0}


@cache
def load_rulepack(name: str = "amazon") -> dict:
    return yaml.safe_load((RULEPACK_DIR / f"{name}.yaml").read_text())


def score(results, weights: dict) -> int:
    total = sum(weights[result.rule_id] for result in results)
    earned = sum(weights[result.rule_id] * STATUS_POINTS[result.status] for result in results)
    return round(100 * earned / total)


def overall_status(results) -> Status:
    statuses = {result.status for result in results}
    if Status.RESHOOT in statuses:
        return Status.RESHOOT
    return Status.FIXABLE if Status.FIXABLE in statuses else Status.PASS


def build_context(image: np.ndarray, rulepack: str = "amazon", segmentation: str | None = None) -> Context:
    """Segment once; border bands are never product, so they leave both masks before anything else."""
    config = load_rulepack(rulepack)
    mask, mode = segment_product(image, segmentation or config["segmentation"])
    band = border_band(image.shape[:2], find_border(image, config))
    mask[band] = 0
    boxes = detect_text(image, config)
    if mode == "studio":
        mask, _ = split_text_overlays(mask, boxes)
    protect = protect_mask(image, mask, mode)
    protect[band] = 0
    return Context(image=image, mask=mask, protect=protect, config=config, mode=mode, _text_boxes=boxes)


def inspect_context(ctx: Context, rulepack: str = "amazon") -> dict:
    results = [rule(ctx) for rule in ALL_RULES]
    return {
        "rulepack": rulepack,
        "width": ctx.width,
        "height": ctx.height,
        "score": score(results, ctx.config["weights"]),
        "status": overall_status(results).value,
        "rules": [result.to_dict() for result in results],
    }


def inspect_image(image: np.ndarray, rulepack: str = "amazon", segmentation: str | None = None) -> tuple[dict, Context]:
    ctx = build_context(image, rulepack, segmentation)
    return inspect_context(ctx, rulepack), ctx


def draw_overlay(ctx: Context, report: dict) -> np.ndarray:
    """Visual evidence: product outline (green), bounding box (blue), added text (red), product text (yellow)."""
    overlay = ctx.image.copy()
    contours, _ = cv2.findContours(ctx.mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    thickness = max(2, max(ctx.height, ctx.width) // 400)
    cv2.drawContours(overlay, contours, -1, (0, 200, 0), thickness)

    rules = {rule["rule_id"]: rule for rule in report["rules"]}
    if bbox := rules["R2"]["evidence"].get("bbox"):
        x, y, w, h = bbox
        cv2.rectangle(overlay, (x, y), (x + w, y + h), (255, 120, 0), thickness)
    for box in rules["R4"]["evidence"].get("added_text_boxes", []):
        cv2.polylines(overlay, [np.asarray(box, np.int32)], True, (0, 0, 255), thickness)
    for box in rules["R4"]["evidence"].get("product_text_boxes", []):
        cv2.polylines(overlay, [np.asarray(box, np.int32)], True, (0, 220, 255), thickness)

    label = f"score {report['score']}  {report['status']}"
    cv2.putText(overlay, label, (12, 12 + 24 * thickness), cv2.FONT_HERSHEY_SIMPLEX, 0.6 * thickness, (40, 40, 40), thickness)
    return overlay


__all__ = ["build_context", "inspect_context", "inspect_image", "draw_overlay", "load_rulepack"]
