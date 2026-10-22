"""Precompute gallery results so judges see full examples without spending Claude calls.

Uses whatever store the environment selects: local by default, or S3 + DynamoDB when
RESULTS_BUCKET and RESULTS_TABLE are set (point AWS credentials at the deployed stack).

uv run python scripts/build_gallery.py data/abo/91wf28y8wLL.jpg data/abo/919w0ZGRAWL.jpg ...
PLANNER=claude AGENT_BACKEND=bedrock uv run python scripts/build_gallery.py ...
"""

import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api import service  # noqa: E402
from api.storage import make_store  # noqa: E402


def main(paths: list[str]) -> None:
    store = make_store()
    for path in map(Path, paths):
        record = service.analyse(store, base64.b64encode(path.read_bytes()).decode(), path.name, gallery=True)
        service.run_fix(store, record["id"])
        done = store.get_result(record["id"])
        after = done["after"]["score"] if done.get("after") else None
        print(f"{path.name:24} {done['state']:6} {done['before']['score']} -> {after}  [{done['planner']}]")


if __name__ == "__main__":
    main(sys.argv[1:])
