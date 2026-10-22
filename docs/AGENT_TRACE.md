# Agent traces and failure handling

Evidence for the Agentic Vision path: OpenCV 5 output changes what the agent does next, failures are
caught, every step is observable, and uncertain cases go to a person. Both traces below are real runs of
Claude Opus 4.6 on Amazon Bedrock (ap-southeast-2), recorded with `scripts/agent_trace.py`.

## How the loop works

Claude never sees pixels. It starts from OpenCV's inspection report (JSON) and can only act through six
tools. After every tool call the session (`agent/session.py`) verifies the edit, re-runs the OpenCV
inspection and returns the fresh report as the tool result, so each decision is made on the latest
visual evidence.

## Trace 1: full fix, each inspection drives the next step

### `demo_phone_case.jpg` (planner: claude)

**Perception (OpenCV 5):** score 70, failing: R1 FIXABLE, R2 FIXABLE, R4 FIXABLE, R5 FIXABLE.

| Step | Decision (Claude): tool and reason | Action result | Fresh OpenCV inspection returned to Claude |
| --- | --- | --- | --- |
| 1 | `remove_border`: Uniform border detected on all sides must be removed. | applied: product pixels changed: 0 | score 73, failing: R1 FIXABLE, R2 FIXABLE, R4 FIXABLE |
| 2 | `inpaint_watermark`: Text badge/watermark found on background needs removal. | applied: product pixels changed: 0 | score 83, failing: R1 FIXABLE, R2 FIXABLE |
| 3 | `whiten_background`: Background is 98% near-white but needs pure white RGB 255. | applied: product pixels changed: 0 | score 93, failing: R2 FIXABLE |
| 4 | `recrop_to_fill` `{'target': 0.87}`: Product only fills 54% of frame; needs to fill ~87%. | applied: product pixels changed: 0 | score 100, failing: none |

**Final:** score 70 -> 100; product pixels changed: 0 of 616,621 compared.

**Claude's summary to the seller:** All issues were fixed automatically: I removed the border, inpainted a watermark/badge, whitened the background to pure white, and recropped so the product fills the frame properly. The score went from 70 to 100. No reshoot is needed.

Each row's fresh inspection removes the rule just fixed, and Claude's next call targets a rule that is
still failing: border (R5), then the badge (R4), then the backdrop (R1), then the fill (R2).

## Trace 2: perception says "do not edit", the agent hands over to a person

### `91jyrWkdDZL.jpg` (planner: claude)

**Perception (OpenCV 5):** score 80, failing: R1 RESHOOT.

No tool calls: OpenCV classified the photo as a scene (R1 RESHOOT), so Claude decided that editing could not fix it and went straight to its summary.

**Final:** score 80 -> 80; product pixels changed: 0 of 1,897,396 compared.

**Claude's summary to the seller:** The main image is a lifestyle or scene photo, which cannot be converted to a pure white background through editing alone. You'll need to reshoot the product by itself on a plain white backdrop. The current score is 80.

**Handed to a human:** R1: The image is a lifestyle/scene photo; the product must be photographed alone on a pure white background.

## Failure handling

| Safeguard | Where | Evidence |
| --- | --- | --- |
| An edit that changes any product pixel is rejected | `agent/session.py`, `core/fixes.py` | Test `test_guarantee_catches_a_product_edit`: one changed product pixel fails the check |
| An edit that lowers the score is rejected and reported back to the planner | `agent/session.py` | Regression run on `719Z1vFJUBL.jpg`: `pad_to_square` rejected, "score would drop 100 -> 93"; test `test_session_rejects_a_fix_that_lowers_the_score` |
| Tools refuse unsafe inputs | `core/fixes.py` | Scene photos: whitening, cropping, padding and text removal raise errors instead of guessing; test `test_scene_photo_is_never_edited` |
| Claude refuses or the API fails | `agent/runner.py` | The deterministic rule planner finishes the job; test `test_claude_refusal_falls_back_to_rules` |
| Step budget | `agent/session.py` | At most 8 applied steps and 12 planning turns per image |
| Unfixed rules are never silently left | `agent/session.py` | Rules still fixable after a run are listed as "Needs a person", with the reason the tool gave |

## Observability

- Every step (tool, input, Claude's reason, outcome, verification detail, score after) is stored in
  DynamoDB as it happens and shown live in the UI's agent timeline, including the step currently running.
- Lambda logs go to Amazon CloudWatch; planner fallbacks and refusals are logged as warnings.
- The final result records the planner used and the guarantee: product pixels compared and changed.

## Human control

- The agent never publishes anything; the seller reviews the before/after, the proof and the summary,
  then decides whether to download and use the fixed image.
- Anything the agent cannot fix safely is returned as "Needs a new photo" or "Needs a person".
- Operators can switch the planner to the deterministic rule planner (`PLANNER=rules`) and cap daily
  Claude use (`DAILY_CLAUDE_LIMIT`).
