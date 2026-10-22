"""Run a rule pack on one image: segmentation once, then every rule, then a weighted score."""

from functools import cache
from pathlib import Path

import cv2
import numpy as np
import yaml

from core.rules import ALL_RULES, text_boxes
from core.segment import protect_mask, segment_product
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


def inspect_image(image: np.ndarray, rulepack: str = "amazon", segmentation: str | None = None) -> tuple[dict, Context]:
    config = load_rulepack(rulepack)
    mask = segment_product(image, segmentation or config["segmentation"])
    ctx = Context(image=image, mask=mask, protect=protect_mask(image, mask), config=config)
    results = [rule(ctx) for rule in ALL_RULES]
    report = {
        "rulepack": rulepack,
        "width": ctx.width,
        "height": ctx.height,
        "score": score(results, config["weights"]),
        "status": overall_status(results).value,
        "rules": [result.to_dict() for result in results],
    }
    return report, ctx


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


__all__ = ["inspect_image", "draw_overlay", "load_rulepack", "text_boxes"]
