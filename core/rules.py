"""The 8 main-image compliance rules. Each takes a Context and returns a RuleResult."""

import cv2
import numpy as np

from core import models
from core.types import Context, RuleResult, Status


def _bbox(mask: np.ndarray) -> tuple[int, int, int, int] | None:
    points = cv2.findNonZero(mask)
    if points is None:
        return None
    return cv2.boundingRect(points)  # x, y, w, h


def _background_mask(ctx: Context) -> np.ndarray:
    margin = max(3, int(max(ctx.height, ctx.width) * ctx.config["background"]["edge_margin"]))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * margin + 1, 2 * margin + 1))
    return cv2.bitwise_not(cv2.dilate(ctx.protect, kernel))


def detect_text(image: np.ndarray, config: dict) -> list[np.ndarray]:
    """Text quadrilaterals (4x2 int arrays) in image coordinates, PP-OCRv3 DB detector."""
    cfg = config["text"]
    height, width = image.shape[:2]
    scale = min(1.0, cfg["max_long_side"] / max(height, width))
    size = (max(32, round(width * scale / 32) * 32), max(32, round(height * scale / 32) * 32))
    detector = models.text_detector()
    detector.setInputParams(1.0 / 255.0, size, (122.67891434, 116.66876762, 104.00698793))
    boxes, _ = detector.detect(image)
    return [np.asarray(box, dtype=np.int32).reshape(4, 2) for box in boxes]


def text_boxes(ctx: Context) -> list[np.ndarray]:
    if ctx._text_boxes is None:
        ctx._text_boxes = detect_text(ctx.image, ctx.config)
    return ctx._text_boxes


def r1_background(ctx: Context) -> RuleResult:
    cfg = ctx.config["background"]
    if ctx.mode == "scene":
        return RuleResult(
            "R1", "Pure white background", Status.RESHOOT, 0.0,
            "This is a lifestyle or scene photo; a main image needs the product alone on a plain white backdrop.",
            evidence={"mode": "scene"},
        )
    background = _background_mask(ctx) > 0
    if not background.any():
        return RuleResult("R1", "Pure white background", Status.PASS, 1.0, "No visible background around the product.")

    channel_min = ctx.image.min(axis=2)[background]
    pure_share = float((channel_min >= cfg["pure_value"]).mean())
    near_share = float((channel_min >= cfg["near_white_value"]).mean())
    evidence = {"pure_share": round(pure_share, 4), "near_white_share": round(near_share, 4)}

    if pure_share >= cfg["pass_share"]:
        return RuleResult("R1", "Pure white background", Status.PASS, pure_share, "Background is pure white.", evidence=evidence)
    if near_share >= cfg["pass_share"]:
        reason = f"Background is off-white: only {pure_share:.0%} of it is RGB 255."
    else:
        reason = f"Background is not white ({near_share:.0%} near-white); replace it using the product mask."
    return RuleResult("R1", "Pure white background", Status.FIXABLE, pure_share, reason, ["whiten_background"], evidence)


def r2_fill(ctx: Context) -> RuleResult:
    cfg = ctx.config["fill"]
    bbox = _bbox(ctx.mask)
    if bbox is None:
        return RuleResult("R2", "Product fills 85% of frame", Status.RESHOOT, 0.0, "No product found.")
    x, y, w, h = bbox
    ratio = max(w / ctx.width, h / ctx.height)
    evidence = {"bbox": [x, y, w, h], "fill_ratio": round(ratio, 4)}
    if ratio >= cfg["pass_ratio"]:
        return RuleResult("R2", "Product fills 85% of frame", Status.PASS, ratio, f"Product fills {ratio:.0%}.", evidence=evidence)

    cropped_long_side = max(w, h) / cfg["target_ratio"]
    evidence["long_side_after_crop"] = round(cropped_long_side)
    if cropped_long_side < ctx.config["resolution"]["hard_min_long_side"]:
        return RuleResult(
            "R2", "Product fills 85% of frame", Status.RESHOOT, ratio,
            f"Product fills {ratio:.0%}; cropping would leave only {cropped_long_side:.0f}px.", evidence=evidence,
        )
    return RuleResult(
        "R2", "Product fills 85% of frame", Status.FIXABLE, ratio,
        f"Product fills only {ratio:.0%}; crop closer.", ["recrop_to_fill", "pad_to_square"], evidence,
    )


def r3_resolution(ctx: Context) -> RuleResult:
    cfg = ctx.config["resolution"]
    long_side = max(ctx.height, ctx.width)
    evidence = {"width": ctx.width, "height": ctx.height}
    if long_side >= cfg["pass_long_side"]:
        return RuleResult("R3", "Resolution", Status.PASS, 1.0, f"Longest side is {long_side}px.", evidence=evidence)
    value = long_side / cfg["pass_long_side"]
    if long_side * 2 >= cfg["pass_long_side"] and long_side >= cfg["hard_min_long_side"]:
        return RuleResult(
            "R3", "Resolution", Status.FIXABLE, value,
            f"Longest side is {long_side}px; a 2x upscale reaches {cfg['pass_long_side']}px.", ["upscale"], evidence,
        )
    return RuleResult("R3", "Resolution", Status.RESHOOT, value, f"Longest side is only {long_side}px.", evidence=evidence)


def r4_text(ctx: Context) -> RuleResult:
    allowed_overlap = ctx.config["text"]["product_overlap_allowed"]
    added, printed = [], []
    for box in text_boxes(ctx):
        box_mask = np.zeros_like(ctx.mask)
        cv2.fillPoly(box_mask, [box], 255)
        area = max(int((box_mask > 0).sum()), 1)
        overlap = float(((box_mask > 0) & (ctx.mask > 0)).sum()) / area
        (printed if overlap > allowed_overlap else added).append(box.tolist())

    evidence = {"added_text_boxes": added, "product_text_boxes": printed}
    if not added:
        reason = "No added text." if not printed else f"{len(printed)} text area(s) are on the product itself (allowed)."
        return RuleResult("R4", "No added text or badges", Status.PASS, 1.0, reason, evidence=evidence)
    return RuleResult(
        "R4", "No added text or badges", Status.FIXABLE, 0.0,
        f"{len(added)} text area(s) sit on the background, likely badges or watermarks.", ["inpaint_watermark"], evidence,
    )


def border_thickness(line_means: np.ndarray, line_stds: np.ndarray, min_contrast: float, max_std: float) -> int:
    """Lines (edge inward) forming a uniform band that contrasts with what lies inside it; 0 = no border.

    Uniform along the WHOLE side, so a product merely touching the edge never counts, and a plain
    coloured background (uniform all the way in) has no inner contrast, so it never counts either.
    """
    if line_stds[0] > max_std:
        return 0
    thickness = 0
    while (
        thickness < len(line_means) and line_stds[thickness] <= max_std
        and abs(line_means[thickness] - line_means[0]) < min_contrast / 2
    ):
        thickness += 1
    if thickness == len(line_means):
        return 0
    inside = min(thickness + 2, len(line_means) - 1)
    contrasts = abs(line_means[0] - line_means[inside]) >= min_contrast or line_stds[inside] > max_std
    return thickness if contrasts else 0


def find_border(image: np.ndarray, config: dict) -> dict[str, int]:
    """Border thickness in px per side that has one (top/bottom/left/right)."""
    cfg = config["border"]
    max_lines = max(4, int(max(image.shape[:2]) * cfg["max_share"]))
    luma = image.astype(np.float32).mean(axis=2)
    lines = {  # each side as (lines from the edge inward, pixels along the line)
        "top": luma[:max_lines], "bottom": luma[::-1][:max_lines],
        "left": luma[:, :max_lines].T, "right": luma[:, ::-1][:, :max_lines].T,
    }
    thickness = {}
    for side, band in lines.items():
        if band[0].mean() >= config["background"]["near_white_value"]:
            continue  # white margin is background, not a border
        found = border_thickness(band.mean(axis=1), band.std(axis=1), cfg["min_contrast"], cfg["max_std"])
        if found:
            thickness[side] = found
    return thickness


def border_band(shape: tuple[int, int], thickness: dict[str, int], extra: int = 2) -> np.ndarray:
    """Boolean mask of the border bands, widened by `extra` px to cover anti-aliased edges."""
    height, width = shape
    band = np.zeros((height, width), bool)
    if "top" in thickness:
        band[: thickness["top"] + extra] = True
    if "bottom" in thickness:
        band[height - thickness["bottom"] - extra:] = True
    if "left" in thickness:
        band[:, : thickness["left"] + extra] = True
    if "right" in thickness:
        band[:, width - thickness["right"] - extra:] = True
    return band


def r5_border(ctx: Context) -> RuleResult:
    thickness = find_border(ctx.image, ctx.config)
    sides = list(thickness)
    evidence = {"border_sides": sides, "thickness_px": thickness}
    if not sides:
        return RuleResult("R5", "No border or frame", Status.PASS, 1.0, "No border found.", evidence=evidence)
    return RuleResult(
        "R5", "No border or frame", Status.FIXABLE, 0.0, f"Uniform border on: {', '.join(sides)}.", ["remove_border"], evidence,
    )


def r6_sharpness(ctx: Context) -> RuleResult:
    cfg = ctx.config["sharpness"]
    scale = 1000 / max(ctx.height, ctx.width)
    gray = cv2.cvtColor(cv2.resize(ctx.image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
    region = cv2.resize(ctx.mask, (gray.shape[1], gray.shape[0]), interpolation=cv2.INTER_NEAREST)
    region = cv2.dilate(region, np.ones((9, 9), np.uint8)) > 0  # include the product's outline
    if not region.any():
        return RuleResult("R6", "Sharp, in focus", Status.RESHOOT, 0.0, "No product found.")
    variance = float(cv2.Laplacian(gray, cv2.CV_64F)[region].var())
    evidence = {"laplacian_var": round(variance, 1)}
    value = min(1.0, variance / cfg["min_laplacian_var"])
    if variance >= cfg["min_laplacian_var"]:
        return RuleResult("R6", "Sharp, in focus", Status.PASS, value, "Product is sharp.", evidence=evidence)
    return RuleResult("R6", "Sharp, in focus", Status.RESHOOT, value, f"Product looks blurry (score {variance:.0f}).", evidence=evidence)


def r7_framing(ctx: Context) -> RuleResult:
    cfg = ctx.config["framing"]
    bbox = _bbox(ctx.mask)
    if bbox is None:
        return RuleResult("R7", "Centred, not cut off", Status.RESHOOT, 0.0, "No product found.")
    product = ctx.mask > 0
    touching = {
        "top": product[0, :].mean(), "bottom": product[-1, :].mean(),
        "left": product[:, 0].mean(), "right": product[:, -1].mean(),
    }
    cut_sides = [side for side, share in touching.items() if share >= cfg["edge_touch_share"]]
    x, y, w, h = bbox
    offset = max(abs(x + w / 2 - ctx.width / 2) / ctx.width, abs(y + h / 2 - ctx.height / 2) / ctx.height)
    evidence = {"cut_off_sides": cut_sides, "center_offset": round(offset, 4)}

    # A product filling the frame edge-to-edge touches both opposite sides; that is fill, not a cut-off.
    opposite_pairs = ({"top", "bottom"} <= set(cut_sides)) or ({"left", "right"} <= set(cut_sides))
    if cut_sides and not opposite_pairs:
        return RuleResult(
            "R7", "Centred, not cut off", Status.RESHOOT, 0.0, f"Product is cut off at the {', '.join(cut_sides)} edge.",
            evidence=evidence,
        )
    if offset > cfg["max_center_offset"]:
        return RuleResult(
            "R7", "Centred, not cut off", Status.FIXABLE, 1 - offset, f"Product is off-centre by {offset:.0%}.",
            ["recrop_to_fill", "pad_to_square"], evidence,
        )
    return RuleResult("R7", "Centred, not cut off", Status.PASS, 1.0, "Product is centred and whole.", evidence=evidence)


def r8_exposure(ctx: Context) -> RuleResult:
    cfg = ctx.config["exposure"]
    product = ctx.mask > 0
    if not product.any():
        return RuleResult("R8", "Exposure", Status.RESHOOT, 0.0, "No product found.")
    # Pure-white pixels inside the mask are usually holes (a ring, a basket) that the
    # segmenter filled in, not blown highlights, so they are left out of the judgement.
    not_white = ctx.image.min(axis=2) < 250
    luma = cv2.cvtColor(ctx.image, cv2.COLOR_BGR2GRAY)[product & not_white]
    judged_share = luma.size / int(product.sum())
    if judged_share < cfg["min_judged_share"]:
        return RuleResult(
            "R8", "Exposure", Status.PASS, 1.0, "Mostly white product; exposure not judged.",
            evidence={"judged_share": round(judged_share, 4)},
        )
    mean, brightest = float(luma.mean()), float(np.percentile(luma, 99))
    evidence = {"mean_luma": round(mean, 1), "p99_luma": round(brightest, 1), "judged_share": round(judged_share, 4)}
    if mean > cfg["max_mean_luma"]:
        return RuleResult("R8", "Exposure", Status.RESHOOT, 1 - mean / 255, "Product looks washed out.", evidence=evidence)
    # A black product still has highlights; an underexposed photo has none.
    if brightest < cfg["min_p99_luma"]:
        return RuleResult("R8", "Exposure", Status.RESHOOT, brightest / 255, "Product is underexposed.", evidence=evidence)
    return RuleResult("R8", "Exposure", Status.PASS, 1.0, "Exposure is fine.", evidence=evidence)


ALL_RULES = [r1_background, r2_fill, r3_resolution, r4_text, r5_border, r6_sharpness, r7_framing, r8_exposure]
