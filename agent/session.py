"""One fixing session: the only way a planner can change an image.

Every tool call is checked twice before it is kept: the product-unchanged guarantee, and the
score must not drop. Steps are reported through a callback so the UI can show them live.
"""

from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np

from core.fixes import TOOLS, FixError, FixState, Guarantee, check_product_unchanged
from core.inspector import draw_overlay, inspect_context
from core.types import Context

MAX_APPLIED_STEPS = 8


@dataclass
class Step:
    n: int
    tool: str
    input: dict
    reason: str
    outcome: str  # applied | rejected | error
    detail: str
    score_after: int | None

    def to_dict(self) -> dict:
        return self.__dict__.copy()


def compact_report(report: dict) -> dict:
    """What a planner needs: score, status and the rules that are not passing."""
    return {
        "score": report["score"],
        "status": report["status"],
        "size": [report["width"], report["height"]],
        "violations": [
            {"rule": rule["rule_id"], "name": rule["name"], "status": rule["status"], "reason": rule["reason"],
             "suggested_tools": rule["fix_tools"]}
            for rule in report["rules"] if rule["status"] != "PASS"
        ],
    }


@dataclass
class Session:
    ctx: Context
    before: dict
    on_step: Callable[["Session"], None] = lambda session: None
    steps: list[Step] = field(default_factory=list)
    summary: str | None = None
    needs_reshoot: list[dict] = field(default_factory=list)

    def __post_init__(self):
        self.state = FixState.from_context(self.ctx)
        self.report = self.before
        self._original = self.ctx.image
        self._original_protect = self.ctx.protect

    @property
    def applied_count(self) -> int:
        return sum(step.outcome == "applied" for step in self.steps)

    def _context(self, state: FixState) -> Context:
        return Context(image=state.image, mask=state.mask, protect=state.protect, config=self.ctx.config, mode=state.mode)

    def _record(self, tool: str, args: dict, reason: str, outcome: str, detail: str, score: int | None) -> dict:
        step = Step(len(self.steps) + 1, tool, args, reason, outcome, detail, score)
        self.steps.append(step)
        self.on_step(self)
        return {"outcome": outcome, "detail": detail, **compact_report(self.report)}

    def apply(self, tool: str, args: dict, reason: str) -> dict:
        """Run one fix tool. Returns a JSON-able observation for the planner."""
        if tool not in TOOLS:
            return self._record(tool, args, reason, "error", f"unknown tool {tool}", None)
        if self.applied_count >= MAX_APPLIED_STEPS:
            return self._record(tool, args, reason, "rejected", "step budget used up; call finish", None)
        try:
            candidate = TOOLS[tool](self.state, self.ctx.config, **args)
        except (FixError, TypeError) as error:
            return self._record(tool, args, reason, "error", str(error), None)

        guarantee = check_product_unchanged(self._original, self._original_protect, candidate)
        if not guarantee.passed:
            detail = f"rejected: would change {guarantee.changed_pixels} product pixels"
            return self._record(tool, args, reason, "rejected", detail, None)

        report = inspect_context(self._context(candidate), self.ctx.config["marketplace"])
        if report["score"] < self.report["score"]:
            detail = f"rejected: score would drop {self.report['score']} -> {report['score']}"
            return self._record(tool, args, reason, "rejected", detail, None)

        self.state, self.report = candidate, report
        detail = f"product pixels changed: {guarantee.changed_pixels}"
        if guarantee.psnr_db is not None:
            detail += f" (after 2x upscale, PSNR {guarantee.psnr_db:.1f} dB)"
        return self._record(tool, args, reason, "applied", detail, report["score"])

    def finish(self, summary: str, needs_reshoot: list[dict]) -> None:
        self.summary = summary
        self.needs_reshoot = needs_reshoot

    def final_guarantee(self) -> Guarantee:
        return check_product_unchanged(self._original, self._original_protect, self.state)

    def final_overlay(self) -> np.ndarray:
        return draw_overlay(self._context(self.state), self.report)

    def reshoot_from_report(self) -> list[dict]:
        return [{"rule_id": rule["rule_id"], "reason": rule["reason"]}
                for rule in self.report["rules"] if rule["status"] == "RESHOOT"]
