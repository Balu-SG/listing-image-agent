"""Compare the inspector with hand labels and print a per-rule table for the README.

labels.csv columns: image,R1,...,R8 with PASS / FIXABLE / RESHOOT (blank = not labelled).
A "violation" is anything other than PASS; precision/recall are for catching violations.

uv run python eval/run_eval.py --images data/abo --labels eval/labels.csv
"""

import argparse
import csv
import sys
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.inspector import inspect_image  # noqa: E402

RULE_IDS = [f"R{index}" for index in range(1, 9)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", type=Path, required=True)
    parser.add_argument("--labels", type=Path, default=Path("eval/labels.csv"))
    parser.add_argument("--rulepack", default="amazon")
    args = parser.parse_args()

    counts = {rule_id: {"tp": 0, "fp": 0, "fn": 0, "tn": 0, "exact": 0, "n": 0} for rule_id in RULE_IDS}
    with args.labels.open() as handle:
        for label in csv.DictReader(handle):
            image = cv2.imread(str(args.images / label["image"]))
            if image is None:
                print(f"skip {label['image']}: not found", file=sys.stderr)
                continue
            report, _ = inspect_image(image, args.rulepack)
            predicted = {rule["rule_id"]: rule["status"] for rule in report["rules"]}
            for rule_id in RULE_IDS:
                expected = (label.get(rule_id) or "").strip().upper()
                if not expected:
                    continue
                tally = counts[rule_id]
                tally["n"] += 1
                tally["exact"] += predicted[rule_id] == expected
                truth, guess = expected != "PASS", predicted[rule_id] != "PASS"
                tally[{(True, True): "tp", (False, True): "fp", (True, False): "fn", (False, False): "tn"}[(truth, guess)]] += 1

    print("| Rule | Labelled | Precision | Recall | Exact status match |")
    print("| --- | --- | --- | --- | --- |")
    for rule_id, tally in counts.items():
        if not tally["n"]:
            continue
        precision = tally["tp"] / max(tally["tp"] + tally["fp"], 1)
        recall = tally["tp"] / max(tally["tp"] + tally["fn"], 1)
        print(f"| {rule_id} | {tally['n']} | {precision:.2f} | {recall:.2f} | {tally['exact'] / tally['n']:.2f} |")


if __name__ == "__main__":
    main()
