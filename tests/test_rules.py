"""Rule behaviour on synthetic images. Uses threshold segmentation so results are deterministic."""

import cv2
import numpy as np
import pytest

from core import segment
from core.inspector import inspect_image


def product_on(background: int | tuple, size: int = 1200, fill: float = 0.9, offset: tuple = (0, 0)) -> np.ndarray:
    image = np.full((size, size, 3), background, np.uint8)
    side = int(size * fill)
    x0 = (size - side) // 2 + offset[0]
    y0 = (size - side) // 2 + offset[1]
    cv2.rectangle(image, (x0, y0), (x0 + side, y0 + side), (40, 90, 160), -1)
    # texture so the sharpness rule has edges to measure
    for step in range(x0 + 20, x0 + side - 20, 40):
        cv2.line(image, (step, y0 + 20), (step, y0 + side - 20), (220, 220, 220), 3)
    return image


def statuses(image: np.ndarray) -> dict:
    report, _ = inspect_image(image, segmentation="flood")
    return {rule["rule_id"]: rule["status"] for rule in report["rules"]}


def test_compliant_image_passes_everything():
    report, _ = inspect_image(product_on(255), segmentation="flood")
    assert report["status"] == "PASS", report
    assert report["score"] == 100


def test_off_white_background_is_fixable():
    assert statuses(product_on(245))["R1"] == "FIXABLE"


def test_small_product_needs_recrop():
    result = statuses(product_on(255, fill=0.5))
    assert result["R2"] == "FIXABLE"


def test_image_size_follows_amazon():
    """Amazon: 500 px minimum (reshoot below), 1,000+ px recommended for zoom (a note, not a failure)."""
    assert statuses(product_on(255, size=600))["R3"] == "PASS"
    assert statuses(product_on(255, size=400))["R3"] == "RESHOOT"
    report, _ = inspect_image(product_on(255, size=600), segmentation="flood")
    r3 = next(rule for rule in report["rules"] if rule["rule_id"] == "R3")
    assert r3["evidence"]["zoom"] is False and "zoom" in r3["reason"]


def test_off_centre_is_advice_only():
    """Amazon has no centring rule, so off-centre is noted but does not fail."""
    report, _ = inspect_image(product_on(255, fill=0.6, offset=(200, 0)), segmentation="flood")
    r7 = next(rule for rule in report["rules"] if rule["rule_id"] == "R7")
    assert r7["status"] == "PASS" and "off-centre" in r7["reason"]


def test_cut_off_product_needs_reshoot():
    assert statuses(product_on(255, fill=0.6, offset=(400, 0)))["R7"] == "RESHOOT"


def test_border_detected():
    image = product_on(255, fill=0.8)
    cv2.rectangle(image, (0, 0), (1199, 1199), (0, 0, 0), 20)
    assert statuses(image)["R5"] == "FIXABLE"


def test_grey_background_is_not_a_border():
    assert statuses(product_on(200, fill=0.8))["R5"] == "PASS"


def test_blur_needs_reshoot():
    image = cv2.GaussianBlur(product_on(255), (0, 0), 12)
    assert statuses(image)["R6"] == "RESHOOT"


def test_added_text_on_background_is_flagged():
    image = product_on(255, fill=0.7)
    cv2.putText(image, "BESTSELLER", (60, 110), cv2.FONT_HERSHEY_SIMPLEX, 2.5, (0, 0, 220), 6)
    # on a plain backdrop the text is a separate piece mostly covered by text: an overlay, not product
    report, _ = inspect_image(image)
    rule = next(rule for rule in report["rules"] if rule["rule_id"] == "R4")
    assert rule["status"] == "FIXABLE", rule


def test_u2net_segments_a_product():
    mask = segment.segment_u2net(product_on(255, fill=0.6))
    share = (mask > 0).mean()
    assert 0.2 < share < 0.6


@pytest.mark.parametrize("method,mode", [("auto", "studio"), ("flood", "studio"), ("u2net", "scene")])
def test_segmentation_methods_run(method, mode):
    mask, found_mode = segment.segment_product(product_on(255), method)
    assert mask.dtype == np.uint8 and mask.max() == 255
    assert found_mode == mode


def test_scene_background_needs_reshoot():
    rng = np.random.default_rng(0)
    image = np.full((1200, 1200, 3), 180, np.uint8)
    for _ in range(600):  # a "room": hard-edged objects everywhere, no plain backdrop visible
        x, y = rng.integers(0, 1100, 2)
        w, h = rng.integers(40, 300, 2)
        cv2.rectangle(image, (int(x), int(y)), (int(x + w), int(y + h)), [int(c) for c in rng.integers(0, 255, 3)], -1)
    cv2.circle(image, (600, 600), 400, (30, 30, 200), -1)
    grain = rng.normal(0, 10, image.shape)  # real photos have texture; flat synthetic colour does not
    image = np.clip(image + grain, 0, 255).astype(np.uint8)
    report, _ = inspect_image(image)
    rule = next(rule for rule in report["rules"] if rule["rule_id"] == "R1")
    assert rule["status"] == "RESHOOT"


def test_printed_label_stays_product():
    """A can with a printed label: the label must be inside the product mask, not background."""
    image = product_on(255, fill=0.8)
    cv2.rectangle(image, (300, 450), (900, 750), (250, 250, 250), -1)  # near-white label panel inside the product
    report, ctx = inspect_image(image)
    assert ctx.mode == "studio"
    assert ctx.mask[600, 600] == 255
