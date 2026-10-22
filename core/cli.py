"""Inspect images from the command line.

uv run python -m core.cli inspect data/abo/*.jpg --out out/
"""

import argparse
import json
import sys
from pathlib import Path

import cv2

from core.inspector import draw_overlay, inspect_image


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="listing-agent")
    sub = parser.add_subparsers(dest="command", required=True)
    inspect_cmd = sub.add_parser("inspect", help="score images against a rule pack")
    inspect_cmd.add_argument("images", nargs="+", type=Path)
    inspect_cmd.add_argument("--rulepack", default="amazon")
    inspect_cmd.add_argument("--segmentation", choices=["auto", "u2net", "flood"])
    inspect_cmd.add_argument("--out", type=Path, help="write <name>.json and <name>.overlay.png here")
    args = parser.parse_args(argv)

    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
    for path in args.images:
        image = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if image is None:
            print(f"{path}: unreadable", file=sys.stderr)
            continue
        report, ctx = inspect_image(image, args.rulepack, args.segmentation)
        failing = [f"{rule['rule_id']}:{rule['status']}" for rule in report["rules"] if rule["status"] != "PASS"]
        print(f"{path.name:40} score {report['score']:3}  {report['status']:8} {' '.join(failing)}")
        if args.out:
            (args.out / f"{path.stem}.json").write_text(json.dumps(report, indent=2))
            cv2.imwrite(str(args.out / f"{path.stem}.overlay.png"), draw_overlay(ctx, report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
