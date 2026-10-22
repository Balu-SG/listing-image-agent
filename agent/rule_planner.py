"""Deterministic planner: used offline, in tests, when the demo's Claude budget is spent,
and as the fallback if Claude refuses. Re-reads the report after every step."""

from agent.session import Session

# Order matters: borders and badges go before whitening; whitening before measuring fill;
# cropping before squaring. There is no upscaling: Amazon says not to enlarge small images.
PRIORITY = [
    ("R5", "remove_border", "Border found on the frame edge."),
    ("R4", "inpaint_watermark", "Text sits on the background, not the product."),
    ("R1", "whiten_background", "Background is not pure white."),
    ("R2", "recrop_to_fill", "Product is too small in the frame."),
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
        square = session.state.image.shape[0] == session.state.image.shape[1]
        if action is None and not square and session.state.mode == "studio" and "pad_to_square" not in tried:
            action = ("pad_to_square", "A square image fills the search tile without letterboxing.")
        if action is None:
            break
        tool, reason = action
        tried.add(tool)
        session.apply(tool, {}, reason)

    applied = [TOOL_PHRASES[step.tool] for step in session.steps if step.outcome == "applied"]
    reshoot = session.reshoot_from_report()
    before, after = session.before["score"], session.report["score"]
    if applied:
        change = f"The score went from {before} to {after}." if after != before else f"The score stays at {after}."
        summary = f"I {_join(applied)}. {change}"
    else:
        summary = f"Nothing could be improved by editing; the score stays at {after}."
    if reshoot:
        summary += f" {len(reshoot)} {'issue needs' if len(reshoot) == 1 else 'issues need'} a new photo; see the list below."
    unfixed = session.unfixed_from_report()
    if unfixed:
        summary += (f" {len(unfixed)} {'issue could' if len(unfixed) == 1 else 'issues could'} not be fixed safely and "
                    f"{'needs' if len(unfixed) == 1 else 'need'} a person.")
    session.finish(summary, reshoot + unfixed)


TOOL_PHRASES = {
    "remove_border": "removed the border",
    "inpaint_watermark": "removed text from the background",
    "whiten_background": "made the background pure white",
    "recrop_to_fill": "reframed the product to fill the frame",
    "pad_to_square": "padded the image to a square",
}


def _join(parts: list[str]) -> str:
    return parts[0] if len(parts) == 1 else ", ".join(parts[:-1]) + " and " + parts[-1]
