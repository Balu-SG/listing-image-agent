"""Record an agent trace: the inspection Claude starts from, and after every tool call the fresh
OpenCV inspection it receives back, which drives its next decision.

PLANNER=claude AGENT_BACKEND=bedrock BEDROCK_REGION=ap-southeast-2 AGENT_MODEL=claude-opus-4-6-v1 \
  uv run python scripts/agent_trace.py assets/demo/demo_phone_case.jpg > trace.md
"""

import sys
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent import session as session_module  # noqa: E402
from agent.runner import fix_image  # noqa: E402


def failing(report_or_observation: dict) -> str:
    rules = report_or_observation.get("violations")
    if rules is None:
        rules = [{"rule": r["rule_id"], "status": r["status"]} for r in report_or_observation["rules"] if r["status"] != "PASS"]
    return ", ".join(f"{r['rule']} {r['status']}" for r in rules) or "none"


def main(path: str) -> None:
    observations = []
    original_apply = session_module.Session.apply

    def traced_apply(self, tool, args, reason):
        observation = original_apply(self, tool, args, reason)
        observations.append(observation)
        return observation

    session_module.Session.apply = traced_apply
    outcome = fix_image(cv2.imread(path), planner="claude")

    print(f"### `{Path(path).name}` (planner: {outcome['planner']})\n")
    print(f"**Perception (OpenCV 5):** score {outcome['before']['score']}, failing: {failing(outcome['before'])}.\n")
    print("| Step | Decision (Claude): tool and reason | Action result | Fresh OpenCV inspection returned to Claude |")
    print("| --- | --- | --- | --- |")
    for step, observation in zip(outcome["steps"], observations):
        arguments = f" `{step['input']}`" if step["input"] else ""
        print(
            f"| {step['n']} | `{step['tool']}`{arguments}: {step['reason']} | {step['outcome']}: {step['detail']} "
            f"| score {observation['score']}, failing: {failing(observation)} |"
        )
    guarantee = outcome["guarantee"]
    print(f"\n**Final:** score {outcome['before']['score']} -> {outcome['after']['score']}; product pixels changed: "
          f"{guarantee['changed_product_pixels']} of {guarantee['product_pixels']:,} compared.\n")
    print(f"**Claude's summary to the seller:** {outcome['summary']}\n")
    if outcome["needs_reshoot"]:
        print("**Handed to a human:** " + "; ".join(f"{i['rule_id']}: {i['reason']}" for i in outcome["needs_reshoot"]) + "\n")


if __name__ == "__main__":
    main(sys.argv[1])
