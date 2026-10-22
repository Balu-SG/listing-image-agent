"""Agent loop, guarantee and fix tools on synthetic images. Claude is replaced by a scripted
client, so these run offline."""

from types import SimpleNamespace

import cv2
import numpy as np

from agent import claude_planner
from agent.runner import fix_image
from agent.session import Session
from core.fixes import FixState, check_product_unchanged, whiten_background
from core.inspector import build_context, inspect_context
from tests.test_rules import product_on


def off_white_small_product() -> np.ndarray:
    return product_on(245, fill=0.6)


def test_rule_planner_fixes_and_keeps_product():
    outcome = fix_image(off_white_small_product(), planner="rules")
    assert outcome["before"]["score"] < outcome["after"]["score"] == 100
    # cropping drops the resolution, so the plan ends with a 2x upscale, verified by round trip
    assert [step["tool"] for step in outcome["steps"] if step["outcome"] == "applied"] == [
        "whiten_background", "recrop_to_fill", "upscale",
    ]
    assert outcome["guarantee"]["passed"] is True
    assert outcome["guarantee"]["psnr_db"] >= 35


def test_guarantee_catches_a_product_edit():
    ctx = build_context(off_white_small_product())
    state = FixState.from_context(ctx)
    tampered = state.image.copy()
    tampered[600, 600] = (0, 255, 0)  # one product pixel
    result = check_product_unchanged(ctx.image, ctx.protect, FixState(tampered, state.mask, state.protect))
    assert not result.passed and result.changed_pixels == 1


def test_whitening_never_touches_protected_pixels():
    ctx = build_context(off_white_small_product())
    state = whiten_background(FixState.from_context(ctx), ctx.config)
    protected = ctx.protect > 0
    assert np.array_equal(state.image[protected], ctx.image[protected])
    assert (state.image[~protected].min(axis=1) > 250).mean() > 0.99


def test_session_rejects_a_fix_that_lowers_the_score():
    ctx = build_context(product_on(255, fill=0.9))
    session = Session(ctx=ctx, before=inspect_context(ctx))
    observation = session.apply("recrop_to_fill", {"target": 0.5}, "test")
    assert observation["outcome"] == "rejected"
    assert session.report["score"] == 100


def _block(**fields):
    return SimpleNamespace(**fields)


class ScriptedClient:
    """Plays back Claude responses; records what it was sent."""

    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **request):
        self.calls.append({**request, "messages": list(request["messages"])})  # snapshot; the loop appends
        return self.responses.pop(0)


def _tool_turn(tool_id, name, arguments):
    return SimpleNamespace(stop_reason="tool_use", content=[_block(type="tool_use", id=tool_id, name=name, input=arguments)])


def test_claude_planner_loop(monkeypatch):
    client = ScriptedClient([
        _tool_turn("t1", "whiten_background", {"reason": "Background is off-white."}),
        _tool_turn("t2", "recrop_to_fill", {"reason": "Product is small.", "target": 0.88}),
        _tool_turn("t3", "upscale", {"reason": "Cropping lowered the resolution."}),
        _tool_turn("t4", "finish", {"summary": "Whitened and recropped.", "needs_reshoot": []}),
    ])
    monkeypatch.setattr(claude_planner, "make_client", lambda: (client, "claude-opus-5-5"))
    outcome = fix_image(off_white_small_product(), planner="claude")

    assert outcome["planner"] == "claude"
    assert outcome["summary"] == "Whitened and recropped."
    assert outcome["after"]["score"] == 100
    assert [step["reason"] for step in outcome["steps"]] == [
        "Background is off-white.", "Product is small.", "Cropping lowered the resolution.",
    ]
    # every tool result went back to Claude with the matching id
    second_request = client.calls[1]["messages"]
    assert second_request[-1]["content"][0]["tool_use_id"] == "t1"
    assert all(tool.get("strict") for tool in client.calls[0]["tools"])


def test_claude_refusal_falls_back_to_rules(monkeypatch):
    client = ScriptedClient([SimpleNamespace(stop_reason="refusal", stop_details=None, content=[])])
    monkeypatch.setattr(claude_planner, "make_client", lambda: (client, "claude-opus-5-5"))
    outcome = fix_image(off_white_small_product(), planner="claude")
    assert outcome["planner"] == "rules"
    assert outcome["after"]["score"] == 100


def test_scene_photo_is_never_edited():
    rng = np.random.default_rng(1)
    image = np.full((1000, 1000, 3), 120, np.uint8)
    for _ in range(500):
        x, y = rng.integers(0, 950, 2)
        cv2.rectangle(image, (int(x), int(y)), (int(x + 80), int(y + 60)), [int(c) for c in rng.integers(0, 255, 3)], -1)
    image = np.clip(image + rng.normal(0, 10, image.shape), 0, 255).astype(np.uint8)
    outcome = fix_image(image, planner="rules")
    edits = [step["tool"] for step in outcome["steps"] if step["outcome"] == "applied"]
    assert "whiten_background" not in edits and "recrop_to_fill" not in edits
