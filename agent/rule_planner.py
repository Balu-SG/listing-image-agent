"""Deterministic planner: used offline, in tests, when the demo's Claude budget is spent,
and as the fallback if Claude refuses. Re-reads the report after every step."""

from agent.session import Session

# Order matters: borders and badges go before whitening; whitening before measuring fill;
# cropping before squaring; upscaling last because cropping lowers resolution.
PRIORITY = [
    ("R5", "remove_border", "Border found on the frame edge."),
    ("R4", "inpaint_watermark", "Text sits on the background, not the product."),
    ("R1", "whiten_background", "Background is not pure white."),
    ("R2", "recrop_to_fill", "Product is too small in the frame."),
    ("R7", "recrop_to_fill", "Product is off-centre."),
    ("R3", "upscale", "Resolution is below the zoom threshold."),
]


def run(session: Session) -> None:
    tried: set[str] = set()
    while True:
        statuses = {rule["rule_id"]: rule["status"] for rule in session.report["rules"]}
        action = next(
            ((tool, reason) for rule_id, tool, reason in PRIORITY
             if statuses.get(rule_id) == "FIXABLE" and tool not in tried),
            None,
        )
        if action is None and session.state.image.shape[0] != session.state.image.shape[1] and "pad_to_square" not in tried:
            action = ("pad_to_square", "Amazon recommends a square main image.")
        if action is None:
            break
        tool, reason = action
        tried.add(tool)
        session.apply(tool, {}, reason)

    applied = [step.tool for step in session.steps if step.outcome == "applied"]
    reshoot = session.reshoot_from_report()
    summary = (
        f"Applied {len(applied)} fix(es): {', '.join(applied) or 'none'}. "
        f"Score {session.before['score']} -> {session.report['score']}."
    )
    if reshoot:
        summary += " Some issues need a new photo: " + "; ".join(item["reason"] for item in reshoot)
    session.finish(summary, reshoot)
