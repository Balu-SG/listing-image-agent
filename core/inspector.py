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
    """Segment once. A border is found first and segmentation runs on the area inside it: the
    flood starts at the image edge, so a frame would otherwise stop it before it reached the backdrop.
    Border bands are never product."""
    config = load_rulepack(rulepack)
    thickness = find_border(image, config)
    band = border_band(image.shape[:2], thickness)
    height, width = image.shape[:2]
    rows, cols = np.flatnonzero(~band.all(axis=1)), np.flatnonzero(~band.all(axis=0))
    top, bottom = (rows[0], rows[-1] + 1) if rows.size else (0, height)
    left, right = (cols[0], cols[-1] + 1) if cols.size else (0, width)
    inner_mask, mode = segment_product(image[top:bottom, left:right], segmentation or config["segmentation"])
    mask = np.zeros((height, width), np.uint8)
    mask[top:bottom, left:right] = inner_mask
    mask[band] = 0
    boxes = detect_text(image, config)
    if mode == "studio":
        mask, _ = split_text_overlays(image, mask, boxes)
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


ISSUE = (38, 38, 220)      # red (BGR): something to remove
WARN = (0, 150, 235)       # amber: something to change
PRODUCT = (210, 120, 20)   # blue: the protected product outline


def _tint(image: np.ndarray, region: np.ndarray, colour: tuple, alpha: float) -> None:
    if region.any():
        image[region] = (image[region] * (1 - alpha) + np.array(colour) * alpha).astype(np.uint8)


def _tag(image: np.ndarray, text: str, x: int, y: int, colour: tuple, scale: float) -> None:
    """A filled label with white text, kept inside the frame."""
    font, weight = cv2.FONT_HERSHEY_DUPLEX, max(1, round(scale * 1.6))
    (tw, th), base = cv2.getTextSize(text, font, scale, weight)
    pad = max(4, round(6 * scale))
    x = int(min(max(x, 0), image.shape[1] - tw - 2 * pad))
    y = int(min(max(y, th + 2 * pad), image.shape[0]))
    cv2.rectangle(image, (x, y - th - 2 * pad), (x + tw + 2 * pad, y), colour, -1)
    cv2.putText(image, text, (x + pad, y - pad), font, scale, (255, 255, 255), weight, cv2.LINE_AA)


def draw_overlay(ctx: Context, report: dict) -> np.ndarray:
    """The Issues view: what each failing rule found, drawn on the photo.

    Blue outline = protected product. Amber tint = backdrop that is not pure white (R1).
    Red = things to remove: added text (R4), border (R5), cut-off edges (R7).
    Amber box = product extent when it is too small or off-centre (R2, R7).
    """
    overlay = ctx.image.copy()
    rules = {rule["rule_id"]: rule for rule in report["rules"]}
    failing = {rule_id for rule_id, rule in rules.items() if rule["status"] != "PASS"}
    side = max(ctx.height, ctx.width)
    line = max(2, side // 450)
    scale = max(0.5, side / 1600)

    if "R1" in failing and ctx.mode == "studio":
        backdrop = ctx.protect == 0
        _tint(overlay, backdrop & (ctx.image.min(axis=2) < 255), WARN, 0.35)
    if "R5" in failing:
        band = border_band(ctx.image.shape[:2], find_border(ctx.image, ctx.config))
        _tint(overlay, band, ISSUE, 0.55)

    contours, _ = cv2.findContours(ctx.mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay, contours, -1, PRODUCT, line, cv2.LINE_AA)

    if failing & {"R2", "R7"} and (bbox := rules["R2"]["evidence"].get("bbox")):
        x, y, w, h = bbox
        cv2.rectangle(overlay, (x, y), (x + w, y + h), WARN, line, cv2.LINE_AA)
        if "R2" in failing:
            label = f"R2 fills {rules['R2']['evidence']['fill_ratio']:.0%}"
        elif rules["R7"]["evidence"].get("cut_off_sides"):
            label = "R7 cut off at " + " and ".join(rules["R7"]["evidence"]["cut_off_sides"])
        else:
            label = "R7 off-centre"
        _tag(overlay, label, x, y - line, WARN, scale)

    for box in rules["R4"]["evidence"].get("added_text_boxes", []):
        points = np.asarray(box, np.int32)
        region = np.zeros(ctx.mask.shape, np.uint8)
        cv2.fillPoly(region, [points], 255)
        _tint(overlay, region > 0, ISSUE, 0.3)
        cv2.polylines(overlay, [points], True, ISSUE, line, cv2.LINE_AA)
        x, y = points.min(axis=0)
        _tag(overlay, "R4 added text", x, y - line, ISSUE, scale)

    edges = {"top": (0, 0, ctx.width, line * 3), "bottom": (0, ctx.height - line * 3, ctx.width, ctx.height),
             "left": (0, 0, line * 3, ctx.height), "right": (ctx.width - line * 3, 0, ctx.width, ctx.height)}
    for side_name in rules["R7"]["evidence"].get("cut_off_sides", []) if "R7" in failing else []:
        x0, y0, x1, y1 = edges[side_name]
        cv2.rectangle(overlay, (x0, y0), (x1, y1), ISSUE, -1)
    return overlay


__all__ = ["build_context", "inspect_context", "inspect_image", "draw_overlay", "load_rulepack"]
