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
    report, _ = inspect_image(image, segmentation="threshold")
    return {rule["rule_id"]: rule["status"] for rule in report["rules"]}


def test_compliant_image_passes_everything():
    report, _ = inspect_image(product_on(255), segmentation="threshold")
    assert report["status"] == "PASS", report
    assert report["score"] == 100


def test_off_white_background_is_fixable():
    assert statuses(product_on(245))["R1"] == "FIXABLE"


def test_small_product_needs_recrop():
    result = statuses(product_on(255, fill=0.5))
    assert result["R2"] == "FIXABLE"


def test_low_resolution():
    assert statuses(product_on(255, size=600))["R3"] == "FIXABLE"
    assert statuses(product_on(255, size=400))["R3"] == "RESHOOT"


def test_off_centre_product_is_fixable():
    assert statuses(product_on(255, fill=0.6, offset=(200, 0)))["R7"] == "FIXABLE"


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
    # threshold segmentation would count the red text as product, so use the U^2-Net mask here
    report, _ = inspect_image(image, segmentation="u2net")
    rule = next(rule for rule in report["rules"] if rule["rule_id"] == "R4")
    assert rule["status"] == "FIXABLE", rule


def test_u2net_segments_a_product():
    mask = segment.segment_u2net(product_on(255, fill=0.6))
    share = (mask > 0).mean()
    assert 0.2 < share < 0.6


@pytest.mark.parametrize("method", ["auto", "threshold"])
def test_segmentation_methods_run(method):
    mask = segment.segment_product(product_on(255), method)
    assert mask.dtype == np.uint8 and mask.max() == 255
