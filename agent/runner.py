"""Analyse and fix one image end to end. Shared by the CLI, the local API and Lambda."""

import logging
from collections.abc import Callable

import anthropic
import numpy as np

from agent import claude_planner, rule_planner
from agent.session import Session
from core.inspector import build_context, draw_overlay, inspect_context
from core.thumbnail import visibility

log = logging.getLogger(__name__)


def analyse_image(image: np.ndarray, rulepack: str = "amazon") -> dict:
    ctx = build_context(image, rulepack)
    report = inspect_context(ctx, rulepack)
    seen = visibility(image)
    return {
        "report": report,
        "visibility": seen,
        "images": {"original": image, "overlay": draw_overlay(ctx, report)},
    }


def fix_image(
    image: np.ndarray,
    planner: str = "rules",
    rulepack: str = "amazon",
    on_step: Callable[[Session], None] = lambda session: None,
) -> dict:
    """Runs a planner over a session. Images in the result are BGR arrays; the caller stores them."""
    ctx = build_context(image, rulepack)
    session = Session(ctx=ctx, before=inspect_context(ctx, rulepack), on_step=on_step)

    used = planner
    if planner == "claude":
        try:
            used = claude_planner.run(session)
        except anthropic.APIError as error:
            log.warning("Claude unavailable (%s); continuing with the rule planner", error)
            rule_planner.run(session)
            used = "rules"
    else:
        rule_planner.run(session)

    guarantee = session.final_guarantee()
    return {
        "planner": used,
        "before": session.before,
        "after": session.report,
        "steps": [step.to_dict() for step in session.steps],
        "summary": session.summary,
        "needs_reshoot": session.needs_reshoot,
        "guarantee": {
            "passed": guarantee.passed,
            "changed_product_pixels": guarantee.changed_pixels,
            "psnr_db": guarantee.psnr_db,  # set only after super-resolution: a round-trip check
        },
        "visibility_after": visibility(session.state.image),
        "images": {"fixed": session.state.image, "fixed_overlay": session.final_overlay(), "diff": guarantee.diff},
    }
