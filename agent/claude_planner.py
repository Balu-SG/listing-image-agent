"""Claude as the planner: it sees only the inspector's JSON (no pixels) and can only act
through the fix tools, each of which is guarded by the session."""

import json
import logging
import os

import anthropic

from agent import rule_planner
from agent.session import Session, compact_report

log = logging.getLogger(__name__)

MAX_TURNS = 12
BEDROCK_API_VERSION = "bedrock-2023-05-31"

SYSTEM_PROMPT = """You fix product listing main images so they meet a marketplace's image rules.

You see an inspection report (JSON), never the pixels. You change the image only by calling the
fix tools. Every tool result tells you whether the fix was applied, and returns the new report.

The tools are deterministic OpenCV operations that never edit the product itself. The system
rejects any call that would change a product pixel or lower the score, and tells you so.

How to work:
- Plan from the report. Order matters: remove borders and background text first, then whiten the
  background, then recrop (fill), then pad to square. Never enlarge an image: Amazon's rules say
  not to artificially enlarge small images, so a small image needs a better original.
- Only call a tool when a rule it addresses is FIXABLE. Do not repeat a tool that was rejected or
  failed unless something changed.
- RESHOOT problems (blur, cut-off product, bad exposure, too small to recover) cannot be fixed by
  editing; list them for the seller.
- When nothing more can be fixed, call finish with a two- or three-sentence summary for the
  seller: what you changed, the score change, and what still needs a new photo. Plain words,
  no rule IDs in the summary."""

REASON = {"type": "string", "description": "One short sentence: why this fix, for the seller."}


def _tool(name: str, description: str, extra: dict | None = None) -> dict:
    properties = {"reason": REASON, **(extra or {})}
    return {
        "name": name,
        "description": description,
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": properties,
            "required": list(properties),
            "additionalProperties": False,
        },
    }


TOOLS = [
    _tool("remove_border", "Paint a detected border or frame white. Fixes R5."),
    _tool("inpaint_watermark", "Remove text, badges or watermarks that sit on the background (not on the product). Fixes R4."),
    _tool("whiten_background", "Set everything outside the product to pure white RGB 255. Fixes R1."),
    _tool(
        "recrop_to_fill",
        "Reframe to a square around the product so it fills `target` of the frame; also centres it. Fixes R2.",
        {"target": {"type": "number", "description": "Fill ratio between 0.85 and 0.95; 0.87 is a good default."}},
    ),
    _tool("pad_to_square", "Pad with white to a square canvas."),
    {
        "name": "finish",
        "description": "Stop and report to the seller.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string", "description": "Two or three sentences for the seller."},
                "needs_reshoot": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {"rule_id": {"type": "string"}, "reason": {"type": "string"}},
                        "required": ["rule_id", "reason"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": ["summary", "needs_reshoot"],
            "additionalProperties": False,
        },
    },
]


def bedrock_model_id(model: str, region: str) -> str:
    """Bedrock wants a cross-region inference profile id, e.g. au.anthropic.claude-opus-5-5 in Sydney.

    A full id (anything containing "anthropic.") is used as given.
    """
    if "anthropic." in model:
        return model
    prefix = os.environ.get("BEDROCK_PROFILE") or ("au" if region.startswith("ap-southeast-2") else "us" if region.startswith("us-") else "global")
    return f"{prefix}.anthropic.{model}"


def make_client() -> tuple[anthropic.Anthropic, str]:
    backend = os.environ.get("AGENT_BACKEND", "bedrock")
    model = os.environ.get("AGENT_MODEL", "claude-opus-5-5")
    if backend == "bedrock":
        # The standard Bedrock runtime client: available in every Bedrock region and accepts
        # inference profile ids (the Mantle endpoint does not serve Claude in ap-southeast-2).
        region = os.environ.get("BEDROCK_REGION") or os.environ.get("AWS_REGION", "ap-southeast-2")
        return anthropic.AnthropicBedrock(aws_region=region), bedrock_model_id(model, region)
    return anthropic.Anthropic(), model


def run(session: Session) -> str:
    """Returns the planner that finished the job: "claude", or "rules" if Claude refused."""
    client, model = make_client()
    effort = os.environ.get("AGENT_EFFORT", "low")
    messages = [{
        "role": "user",
        "content": "Inspection report for the uploaded main image:\n" + json.dumps(compact_report(session.before)),
    }]

    for _ in range(MAX_TURNS):
        response = client.messages.create(
            # Bedrock InvokeModel only accepts its own version string; the SDK default is the Claude API's.
            **({"extra_body": {"anthropic_version": BEDROCK_API_VERSION}} if isinstance(client, anthropic.AnthropicBedrock) else {}),
            model=model,
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            **({"output_config": {"effort": effort}} if effort else {}),  # AGENT_EFFORT="" for models without effort
            messages=messages,
        )
        if response.stop_reason == "refusal":
            log.warning("Claude declined (%s); finishing with the rule planner", response.stop_details)
            rule_planner.run(session)
            return "rules"

        messages.append({"role": "assistant", "content": response.content})
        tool_uses = [block for block in response.content if block.type == "tool_use"]
        if not tool_uses:
            text = " ".join(block.text for block in response.content if block.type == "text").strip()
            session.finish(text or "Done.", session.reshoot_from_report())
            return "claude"

        results = []
        for block in tool_uses:
            arguments = dict(block.input)
            if block.name == "finish":
                session.finish(arguments["summary"], arguments["needs_reshoot"])
                return "claude"
            reason = arguments.pop("reason", "")
            observation = session.apply(block.name, arguments, reason)
            results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": json.dumps(observation),
                "is_error": observation["outcome"] == "error",
            })
        messages.append({"role": "user", "content": results})

    session.finish("Stopped after the maximum number of planning turns.", session.reshoot_from_report())
    return "claude"
