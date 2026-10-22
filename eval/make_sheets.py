"""Labelling aid: numbered contact sheets of the images plus a blank labels.csv row per image.

Labels are left blank on purpose; pre-filling them with the inspector's own output would bias
the evaluation. Open the sheets, then fill R1..R8 with PASS / FIXABLE / RESHOOT.

uv run python eval/make_sheets.py --images data/abo --out out/label_sheets
"""

import argparse
import csv
from pathlib import Path

import cv2
import numpy as np

TILE = 360
PER_SHEET = 12  # 4 x 3


def tile(path: Path, index: int) -> np.ndarray:
    image = cv2.imread(str(path))
    canvas = np.full((TILE + 40, TILE, 3), 255, np.uint8)
    scale = TILE / max(image.shape[:2])
    small = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    y0, x0 = (TILE - small.shape[0]) // 2, (TILE - small.shape[1]) // 2
    canvas[y0:y0 + small.shape[0], x0:x0 + small.shape[1]] = small
    cv2.rectangle(canvas, (0, 0), (TILE - 1, TILE - 1), (200, 200, 200), 1)
    label = f"{index:02d}  {path.name}  {image.shape[1]}x{image.shape[0]}"
    cv2.putText(canvas, label, (6, TILE + 26), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (30, 30, 30), 1)
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--images", type=Path, default=Path("data/abo"))
    parser.add_argument("--out", type=Path, default=Path("out/label_sheets"))
    parser.add_argument("--labels", type=Path, default=Path("eval/labels.csv"))
    args = parser.parse_args()

    paths = sorted(args.images.glob("*.jpg"))
    args.out.mkdir(parents=True, exist_ok=True)
    for start in range(0, len(paths), PER_SHEET):
        tiles = [tile(path, start + offset + 1) for offset, path in enumerate(paths[start:start + PER_SHEET])]
        tiles += [np.full_like(tiles[0], 255)] * (PER_SHEET - len(tiles))
        rows = [np.hstack(tiles[row * 4:(row + 1) * 4]) for row in range(3)]
        cv2.imwrite(str(args.out / f"sheet_{start // PER_SHEET + 1:02d}.jpg"), np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])

    existing = set()
    if args.labels.exists():
        with args.labels.open() as handle:
            existing = {row["image"] for row in csv.DictReader(handle)}
    new_rows = [path.name for path in paths if path.name not in existing]
    if new_rows:
        write_header = not args.labels.exists() or args.labels.stat().st_size == 0
        with args.labels.open("a", newline="") as handle:
            writer = csv.writer(handle)
            if write_header:
                writer.writerow(["image", *[f"R{index}" for index in range(1, 9)]])
            for name in new_rows:
                writer.writerow([name, *[""] * 8])
    print(f"{len(paths)} images, sheets in {args.out}, {len(new_rows)} blank rows added to {args.labels}")


if __name__ == "__main__":
    main()
