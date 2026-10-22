"""Run the fix agent on images from the command line.

uv run python -m agent.cli data/abo/*.jpg --planner rules --out out/fixed
"""

import argparse
import json
import sys
from pathlib import Path

import cv2

from agent.runner import fix_image


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="listing-agent-fix")
    parser.add_argument("images", nargs="+", type=Path)
    parser.add_argument("--planner", choices=["rules", "claude"], default="rules")
    parser.add_argument("--out", type=Path, default=Path("out/fixed"))
    args = parser.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)

    for path in args.images:
        image = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if image is None:
            print(f"{path}: unreadable", file=sys.stderr)
            continue
        outcome = fix_image(image, planner=args.planner)
        tools = " ".join(f"{step['tool']}:{step['outcome'][0]}" for step in outcome["steps"])
        guarantee = outcome["guarantee"]
        print(
            f"{path.name:22} {outcome['before']['score']:3} -> {outcome['after']['score']:3}  "
            f"unchanged={guarantee['passed']!s:5} [{outcome['planner']}] {tools}"
        )
        cv2.imwrite(str(args.out / f"{path.stem}.fixed.png"), outcome["images"]["fixed"])
        cv2.imwrite(str(args.out / f"{path.stem}.diff.png"), outcome["images"]["diff"])
        serialisable = {key: value for key, value in outcome.items() if key not in {"images", "visibility_after"}}
        serialisable["visibility_after"] = outcome["visibility_after"]["score"]
        (args.out / f"{path.stem}.json").write_text(json.dumps(serialisable, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
