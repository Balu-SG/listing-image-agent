"""Plain-English explanations for every rule, tool and metric, for tooltips and help panels.

Thresholds are read from the rule pack, so the help text always matches what the code checks.
"""

from core.inspector import ISSUE, PRODUCT, WARN, load_rulepack


SOURCE = {
    "title": "Amazon Seller Central: Product image requirements (G1881)",
    "url": "https://sellercentral.amazon.com/help/hub/reference/external/G1881",
    "read_on": "2026-10-22",
}


def rule_help(config: dict) -> dict:
    """`amazon` quotes Amazon's own wording (None where Amazon has no such rule);
    `basis` says whether the rule is Amazon's, derived from one, or our own advice."""
    bg, fill, res, framing = config["background"], config["fill"], config["resolution"], config["framing"]
    return {
        "R1": {
            "title": "Pure white background",
            "basis": "amazon",
            "amazon": "Have a pure white background (RGB color values: 255, 255, 255). Only a limited number of product types are allowed to have a lifestyle image as a main image.",
            "what": "The backdrop around the product must be pure white (RGB 255, 255, 255).",
            "why": "Amazon requires it so search and product pages look consistent; a main image that breaks the rules can get the listing removed from search.",
            "how": (
                f"We find the backdrop by flood-filling inward from the image edges, then count how much of it is exactly 255 "
                f"(at least {bg['pass_share']:.0%}, our threshold). Lifestyle photos are flagged for a reshoot; most product types may not use one."
            ),
            "fix": "whiten_background",
        },
        "R2": {
            "title": "Product fills 85% of the image",
            "basis": "amazon",
            "amazon": "Show the product as 85% of the image.",
            "what": f"The product should take up {fill['pass_ratio']:.0%} of the image.",
            "why": "Amazon's requirement; a small product also looks weak as a search thumbnail.",
            "how": "We measure the product's longest side against the image (our reading of \"85% of the image\").",
            "fix": "recrop_to_fill",
        },
        "R3": {
            "title": "Image size",
            "basis": "amazon",
            "amazon": (
                "Minimum 500 pixels and maximum 10,000 pixels on the longest side. Images with 1,000+ pixels on the "
                "longest side enable the zoom function. Do not artificially enlarge small images."
            ),
            "what": (
                f"Longest side between {res['min_long_side']} and {res['max_long_side']:,} px; "
                f"{res['zoom_long_side']:,}+ px recommended for zoom."
            ),
            "why": "Amazon rejects images outside that range; 1,000+ px enables zoom on the product page.",
            "how": "We read the image size. Under 1,000 px passes with a zoom note. We never enlarge images, because Amazon says not to.",
            "fix": None,
        },
        "R4": {
            "title": "No added text or badges",
            "basis": "amazon",
            "amazon": (
                "No text or pricing details. No badges used on Amazon, or variations, such as \"Amazon's Choice\", "
                "\"Best seller\" or \"Top seller\". No Amazon logos or trademarks."
            ),
            "what": "No text, prices, badges, logos or watermarks added on top of the photo.",
            "why": "Amazon prohibits them on product images. Text printed on the product's own packaging is part of the product.",
            "how": "OpenCV's DB text detector finds text; text inside the product outline counts as packaging, text or flat badges on the backdrop count as added.",
            "fix": "inpaint_watermark",
        },
        "R5": {
            "title": "No border or frame",
            "basis": "derived",
            "amazon": None,
            "what": "No coloured border or frame around the image.",
            "why": "Amazon's page does not name borders, but a border is non-white background, which the pure-white rule does not allow.",
            "how": "We scan inward from each edge, line by line, for a uniform band that differs from what lies inside it.",
            "fix": "remove_border",
        },
        "R6": {
            "title": "Sharp, in focus",
            "basis": "amazon",
            "amazon": "Clear, non-pixelated, no jagged edges. Accurately represent the product as a realistic, professional-quality image.",
            "what": "The product must be in focus.",
            "why": "Amazon's image quality requirement; blurry photos also lose clicks.",
            "how": f"Variance of the Laplacian (edge strength) on the product; below {config['sharpness']['min_laplacian_var']} counts as blurry (our threshold).",
            "fix": None,
        },
        "R7": {
            "title": "Whole product in frame",
            "basis": "amazon",
            "amazon": "Show the entire product within the frame of the image. Do not cut off any part of the product.",
            "what": "No part of the product may be cut off by the image edge.",
            "why": "Amazon's requirement. Centring is our advice only: it is shown as a note and never lowers the score.",
            "how": (
                f"We check whether the product runs into the image edge. We also note when its centre is more than "
                f"{framing['max_center_offset']:.0%} off (advice)."
            ),
            "fix": None,
        },
        "R8": {
            "title": "Exposure",
            "basis": "derived",
            "amazon": "The image should accurately represent the real scale, quantity, and color of the product.",
            "what": "The product is neither washed out nor underexposed.",
            "why": "Bad exposure misrepresents the product's colour, which Amazon's accuracy requirement covers.",
            "how": "Our check: the product's average brightness must not be too high (washed out), and it must have some bright highlights (not underexposed).",
            "fix": None,
        },
    }


NOT_CHECKED = [
    "Only one unit of the product, plus accessories included with it",
    "No props that are not included with the product",
    "No mannequins; clothing in adult sizes on a standing model",
    "Footwear: a single shoe facing left at a 45-degree angle",
    "No packaging unless it is an important product feature",
    "Product shown only once (not front and back together)",
]


TOOL_HELP = {
    "whiten_background": {
        "label": "Whiten background",
        "what": "Sets every backdrop pixel to pure white, with a soft 3 px edge so the product does not look cut out.",
        "safety": "Only pixels outside the protected product area change.",
    },
    "recrop_to_fill": {
        "label": "Reframe to fill",
        "what": "Crops to a square around the product so it fills about 87% of the frame, which also centres it.",
        "safety": "The frame always contains the whole product; pixels are moved, never altered.",
    },
    "pad_to_square": {
        "label": "Pad to square",
        "what": "Adds white space to make the image square, so it fills a square search tile without letterboxing (our choice; Amazon does not require square).",
        "safety": "Only new white pixels are added.",
    },
    "remove_border": {
        "label": "Remove border",
        "what": "Paints a detected border or frame white.",
        "safety": "Refuses if the border touches the product.",
    },
    "inpaint_watermark": {
        "label": "Remove text or badge",
        "what": "Fills in text, badges or watermarks on the backdrop using OpenCV inpainting.",
        "safety": "Only runs on the backdrop; text printed on the product is never touched.",
    },
    "finish": {"label": "Finish", "what": "The planner stops and writes its summary.", "safety": ""},
}

METRIC_HELP = {
    "score": (
        "Compliance score from 0 to 100. Each rule has a weight; a passing rule earns its full weight, "
        "a fixable one half, a reshoot none."
    ),
    "status": {
        "PASS": "Meets the rule.",
        "FIXABLE": "Breaks the rule, but the agent can fix it without touching the product.",
        "RESHOOT": "Breaks the rule in a way editing cannot fix; a new photo is needed.",
    },
    "visibility": (
        "How much your image stands out as a search thumbnail. We place it among 8 other products and "
        "measure where the eye is drawn (spectral-residual saliency). 50 means an average share of attention; "
        "100 means twice its share or more."
    ),
    "guarantee": (
        "After every edit we map the original product pixels onto the new image and compare them one by one. "
        "Any edit that changes even one product pixel is rejected. Edits only change the backdrop or move the "
        "canvas (crop, pad); the product is never resampled or enlarged."
    ),
    "diff_map": "Grey is the product region that was compared; red would mark any product pixel that changed. Black is background.",
    "planner": {
        "claude": "Claude on Amazon Bedrock reads the inspection report (not the image) and decides which tools to run, in what order.",
        "rules": "A fixed rule-based planner chooses the tools. Used offline, as a fallback, or when the demo's daily Claude budget is used up.",
    },
    "segmentation": {
        "studio": "Plain backdrop found: the product outline is reliable, so the backdrop can be edited.",
        "scene": "Lifestyle or scene photo: the product outline is uncertain, so nothing is edited.",
    },
}


def _hex(bgr: tuple) -> str:
    blue, green, red = bgr
    return f"#{red:02x}{green:02x}{blue:02x}"


def meta(rulepack: str = "amazon") -> dict:
    config = load_rulepack(rulepack)
    return {
        "marketplace": config["marketplace"],
        "source": SOURCE,
        "not_checked": NOT_CHECKED,
        "overlay_legend": [
            {"colour": _hex(PRODUCT), "label": "Protected product outline"},
            {"colour": _hex(WARN), "label": "To change: off-white backdrop, or product too small"},
            {"colour": _hex(ISSUE), "label": "To remove or reshoot: added text, border, cut-off edge"},
        ],
        "rules": rule_help(config),
        "weights": config["weights"],
        "tools": TOOL_HELP,
        "metrics": METRIC_HELP,
    }
