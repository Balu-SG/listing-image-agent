"""Download a random sample of Amazon Berkeley Objects (CC BY 4.0) main images.

uv run python scripts/fetch_abo.py --count 60 --out data/abo
"""

import argparse
import csv
import gzip
import io
import json
import random
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = "https://amazon-berkeley-objects.s3.amazonaws.com"
MIN_LONG_SIDE = 500


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def main_image_ids(listing_files: int) -> set[str]:
    ids = set()
    for index in range(listing_files):
        raw = gzip.decompress(fetch(f"{BASE}/listings/metadata/listings_{index}.json.gz"))
        for line in raw.splitlines():
            if image_id := json.loads(line).get("main_image_id"):
                ids.add(image_id)
    return ids


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=60)
    parser.add_argument("--out", type=Path, default=Path("data/abo"))
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--listing-files", type=int, default=1, help="listings_N.json.gz files to scan (16 exist)")
    args = parser.parse_args()

    main_ids = main_image_ids(args.listing_files)
    rows = csv.DictReader(io.TextIOWrapper(io.BytesIO(gzip.decompress(fetch(f"{BASE}/images/metadata/images.csv.gz")))))
    candidates = [
        row for row in rows
        if row["image_id"] in main_ids and max(int(row["width"]), int(row["height"])) >= MIN_LONG_SIDE
    ]
    sample = random.Random(args.seed).sample(candidates, min(args.count, len(candidates)))
    args.out.mkdir(parents=True, exist_ok=True)

    def download(row: dict) -> str:
        target = args.out / f"{row['image_id']}.jpg"
        if not target.exists():
            target.write_bytes(fetch(f"{BASE}/images/original/{row['path']}"))
        return target.name

    with ThreadPoolExecutor(max_workers=8) as pool:
        names = list(pool.map(download, sample))
    print(f"{len(names)} images in {args.out} (from {len(candidates)} main images >= {MIN_LONG_SIDE}px)")


if __name__ == "__main__":
    main()
