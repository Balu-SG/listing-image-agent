"""Deterministic OpenCV fix tools and the product-unchanged guarantee.

Every tool takes and returns a FixState. Pixel tools only write OUTSIDE the protect mask;
geometry tools (crop, pad) move the canvas but never resample the product. There is no
upscaling tool: Amazon's image requirements say "Do not artificially enlarge small images."

The state carries the transform from original to current coordinates, so the product region
of the original can always be mapped onto the current image and compared.
"""

from dataclasses import dataclass, replace

import cv2
import numpy as np

from core.rules import border_band, find_border, text_boxes
from core.types import Context

WHITE = (255, 255, 255)


@dataclass(frozen=True)
class FixState:
    image: np.ndarray
    mask: np.ndarray       # tight product mask in current coordinates
    protect: np.ndarray    # protect mask in current coordinates
    mode: str = "studio"   # only a studio (plain backdrop) image may have its background edited
    offset_x: float = 0.0
    offset_y: float = 0.0

    @classmethod
    def from_context(cls, ctx: Context) -> "FixState":
        return cls(image=ctx.image.copy(), mask=ctx.mask.copy(), protect=ctx.protect.copy(), mode=ctx.mode)


class FixError(ValueError):
    """The tool cannot apply to this image (the planner gets this message back)."""


def _bbox(mask: np.ndarray) -> tuple[int, int, int, int]:
    points = cv2.findNonZero(mask)
    if points is None:
        raise FixError("no product found")
    return cv2.boundingRect(points)


def _reframe(state: FixState, x0: int, y0: int, width: int, height: int) -> FixState:
    """New canvas = window (x0, y0, width, height) of the current one; outside the image is white."""
    canvas = np.full((height, width, 3), 255, np.uint8)
    masks = [np.zeros((height, width), np.uint8) for _ in range(2)]
    src_x0, src_y0 = max(x0, 0), max(y0, 0)
    src_x1, src_y1 = min(x0 + width, state.image.shape[1]), min(y0 + height, state.image.shape[0])
    if src_x1 <= src_x0 or src_y1 <= src_y0:
        raise FixError("window misses the image")
    dst = (slice(src_y0 - y0, src_y1 - y0), slice(src_x0 - x0, src_x1 - x0))
    src = (slice(src_y0, src_y1), slice(src_x0, src_x1))
    canvas[dst] = state.image[src]
    masks[0][dst] = state.mask[src]
    masks[1][dst] = state.protect[src]
    return replace(
        state, image=canvas, mask=masks[0], protect=masks[1],
        offset_x=state.offset_x - x0, offset_y=state.offset_y - y0,
    )


def whiten_background(state: FixState, ctx_config: dict) -> FixState:
    """Set every pixel outside the protect mask to pure white, feathering only on the background side."""
    if state.mode != "studio":
        raise FixError("scene background: cannot safely tell product from scene; needs a studio photo")
    protect = state.protect > 0
    distance = cv2.distanceTransform(np.where(protect, 0, 255).astype(np.uint8), cv2.DIST_L2, 3)
    feather = 3.0
    weight = np.clip(distance / feather, 0.0, 1.0)[..., None]  # 0 at the product edge, 1 a few px out
    blended = state.image.astype(np.float32) * (1 - weight) + 255.0 * weight
    image = np.where(protect[..., None], state.image, np.round(blended).astype(np.uint8))
    return replace(state, image=image)


def recrop_to_fill(state: FixState, ctx_config: dict, target: float | None = None) -> FixState:
    """Square frame centred on the product so its longest side is `target` of the frame.

    The frame always contains the whole protect mask, so nothing protected is cut off.
    """
    if state.mode != "studio":
        raise FixError("scene photo: the product outline is uncertain, so cropping could cut it")
    target = target or ctx_config["fill"]["target_ratio"]
    if not 0.5 <= target <= 0.98:
        raise FixError("target must be between 0.5 and 0.98")
    x, y, w, h = _bbox(state.mask)
    px, py, pw, ph = _bbox(state.protect)
    side = int(np.ceil(max(w, h) / target))
    # Zoom needs 1,000+ px. Loosen the fill toward Amazon's 85% if that keeps the frame at zoom size;
    # never enlarge (Amazon: "Do not artificially enlarge small images").
    zoom, loosest = ctx_config["resolution"]["zoom_long_side"], int(np.floor(max(w, h) / ctx_config["fill"]["pass_ratio"]))
    if side < zoom <= loosest:
        side = zoom
    side = max(side, pw, ph)  # never cut protected pixels
    cx, cy = x + w / 2, y + h / 2
    x0 = int(round(cx - side / 2))
    y0 = int(round(cy - side / 2))
    # slide the frame (not shrink it) until the protect box fits
    x0 = min(max(x0, px + pw - side), px)
    y0 = min(max(y0, py + ph - side), py)
    return _reframe(state, x0, y0, side, side)


def pad_to_square(state: FixState, ctx_config: dict) -> FixState:
    if state.mode != "studio":
        raise FixError("scene photo: white padding would not match the scene; a studio photo is needed")
    height, width = state.image.shape[:2]
    side = max(height, width)
    return _reframe(state, -((side - width) // 2), -((side - height) // 2), side, side)


def remove_border(state: FixState, ctx_config: dict) -> FixState:
    """Paint the border bands found by the R5 scan white, in place: same canvas, no product pixel moves.

    The inspector already excluded these bands from the product and protect masks.
    """
    thickness = find_border(state.image, ctx_config)
    if not thickness:
        raise FixError("no border found")
    band = border_band(state.image.shape[:2], thickness)
    if (state.protect[band] > 0).any():
        raise FixError("the border touches the product")
    image = state.image.copy()
    image[band] = WHITE
    return replace(state, image=image)


def inpaint_watermark(state: FixState, ctx_config: dict) -> FixState:
    """Remove text detected on the background. Only background pixels are inpainted."""
    if state.mode != "studio":
        raise FixError("scene background: text removal only runs on plain backdrops")
    ctx = Context(image=state.image, mask=state.mask, protect=state.protect, config=ctx_config, mode=state.mode)
    allowed = ctx_config["text"]["product_overlap_allowed"]
    region = np.zeros(state.mask.shape, np.uint8)
    for box in text_boxes(ctx):
        box_mask = np.zeros_like(region)
        cv2.fillPoly(box_mask, [box], 255)
        overlap = float(((box_mask > 0) & (state.mask > 0)).sum()) / max(int((box_mask > 0).sum()), 1)
        if overlap <= allowed:
            region |= box_mask
    if not region.any():
        raise FixError("no text on the background")
    pad = max(3, int(max(state.mask.shape) * 0.004))
    region = cv2.dilate(region, np.ones((2 * pad + 1, 2 * pad + 1), np.uint8))
    region[state.protect > 0] = 0
    inpainted = cv2.inpaint(state.image, region, 5, cv2.INPAINT_TELEA)
    image = np.where((region > 0)[..., None], inpainted, state.image)
    return replace(state, image=image)


TOOLS = {
    "whiten_background": whiten_background,
    "recrop_to_fill": recrop_to_fill,
    "pad_to_square": pad_to_square,
    "remove_border": remove_border,
    "inpaint_watermark": inpaint_watermark,
}


@dataclass
class Guarantee:
    passed: bool
    changed_pixels: int
    product_pixels: int
    psnr_db: float | None  # unused since the upscaling tool was removed; kept for the API shape
    diff: np.ndarray  # BGR visualisation in current coordinates


def check_product_unchanged(original: np.ndarray, original_protect: np.ndarray, state: FixState) -> Guarantee:
    """Map the original product region into current coordinates and compare pixel by pixel.

    Tools only crop and pad (integer translations), so the comparison is exact: any changed
    product pixel fails the check. The diff image is black outside the product, grey where the
    product is unchanged and red where a product pixel differs.
    """
    height, width = state.image.shape[:2]
    transform = np.float32([[1, 0, state.offset_x], [0, 1, state.offset_y]])
    reference = cv2.warpAffine(original, transform, (width, height), flags=cv2.INTER_NEAREST, borderValue=WHITE)
    region = cv2.warpAffine(original_protect, transform, (width, height), flags=cv2.INTER_NEAREST) > 0
    changed = region & (np.abs(reference.astype(np.int16) - state.image.astype(np.int16)).max(axis=2) > 0)

    diff = np.zeros((height, width, 3), np.uint8)
    diff[region] = (40, 40, 40)            # product region, unchanged
    diff[changed] = (0, 0, 255)            # changed product pixels
    return Guarantee(not bool(changed.any()), int(changed.sum()), int(region.sum()), None, diff)
