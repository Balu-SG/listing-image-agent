"""Analyse / fix workflow over a store. Fixing runs in the background (thread locally,
asynchronous Lambda self-invocation on AWS); the UI polls the result."""

import base64
import datetime as dt
import json
import logging
import os
import threading
import uuid

import cv2
import numpy as np

from agent.runner import analyse_image, fix_image
from agent.session import Session

log = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 4_500_000
MAX_LONG_SIDE = 2000


class ApiError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def planner_setting() -> str:
    return os.environ.get("PLANNER", "rules")


def model_setting() -> str | None:
    return os.environ.get("AGENT_MODEL", "claude-opus-5-5") if planner_setting() == "claude" else None


def decode_upload(image_base64: str) -> np.ndarray:
    try:
        data = base64.b64decode(image_base64, validate=True)
    except ValueError as error:
        raise ApiError(400, "image_base64 is not valid base64") from error
    if len(data) > MAX_UPLOAD_BYTES:
        raise ApiError(413, "Image is larger than 4.5 MB")
    image = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ApiError(400, "Could not read the image; upload a JPEG or PNG")
    scale = MAX_LONG_SIDE / max(image.shape[:2])
    if scale < 1:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return image


def _put_visibility(store, result_id: str, prefix: str, seen: dict) -> dict:
    return {
        "score": seen["score"],
        "grid": store.put_image(result_id, f"{prefix}_grid", seen["grid"]),
        "saliency": store.put_image(result_id, f"{prefix}_saliency", seen["heat_map"]),
    }


def analyse(store, image_base64: str, filename: str, gallery: bool = False) -> dict:
    image = decode_upload(image_base64)
    result_id = uuid.uuid4().hex[:12]
    analysis = analyse_image(image)
    record = {
        "id": result_id,
        "filename": filename[:120],
        "created_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
        "state": "analyzed",
        "planner": None,
        "gallery": gallery,
        "before": analysis["report"],
        "after": None,
        "visibility_before": _put_visibility(store, result_id, "vis_before", analysis["visibility"]),
        "visibility_after": None,
        "steps": [],
        "summary": None,
        "needs_reshoot": [],
        "guarantee": None,
        "files": {
            "original": store.put_image(result_id, "original", image, lossless=True),
            "overlay": store.put_image(result_id, "overlay", analysis["images"]["overlay"]),
            "fixed": None, "fixed_overlay": None, "diff": None,
        },
        "error": None,
    }
    store.save_result(record)
    return record


def choose_planner(store) -> str:
    """Claude while today's demo budget lasts, then the rule planner."""
    if planner_setting() != "claude":
        return "rules"
    limit = int(os.environ.get("DAILY_CLAUDE_LIMIT", "200"))
    return "claude" if store.count_today("claude") <= limit else "rules"


def run_fix(store, result_id: str) -> None:
    """The background job: runs the agent and saves progress after every step."""
    record = store.get_result(result_id)
    if record is None:
        return
    try:
        path_or_none = store.file_path(record["files"]["original"])
        image = cv2.imread(str(path_or_none)) if path_or_none else _download(store, record["files"]["original"])
        planner = choose_planner(store)
        record["planner"] = planner

        def on_step(session: Session) -> None:
            record["steps"] = [step.to_dict() for step in session.steps]
            store.save_result(record)

        outcome = fix_image(image, planner=planner, on_step=on_step)
        record.update({
            "state": "done",
            "planner": outcome["planner"],
            "after": outcome["after"],
            "steps": outcome["steps"],
            "summary": outcome["summary"],
            "needs_reshoot": outcome["needs_reshoot"],
            "guarantee": outcome["guarantee"],
            "visibility_after": _put_visibility(store, result_id, "vis_after", outcome["visibility_after"]),
        })
        record["files"].update({
            "fixed": store.put_image(result_id, "fixed", outcome["images"]["fixed"], lossless=True),
            "fixed_overlay": store.put_image(result_id, "fixed_overlay", outcome["images"]["fixed_overlay"]),
            "diff": store.put_image(result_id, "diff", outcome["images"]["diff"], lossless=True),
        })
    except Exception as error:  # the UI shows the message; the log keeps the trace
        log.exception("fix failed for %s", result_id)
        record.update({"state": "error", "error": str(error)})
    store.save_result(record)


def _download(store, key: str) -> np.ndarray:
    data = store.s3.get_object(Bucket=store.bucket, Key=key)["Body"].read()
    return cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)


def start_fix(store, result_id: str) -> dict:
    record = store.get_result(result_id)
    if record is None:
        raise ApiError(404, "Unknown result id")
    if record["state"] == "running":
        return {"id": result_id, "state": "running"}
    record.update({"state": "running", "steps": [], "error": None})
    store.save_result(record)

    function_name = os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
    if function_name:
        import boto3

        boto3.client("lambda").invoke(
            FunctionName=function_name, InvocationType="Event",
            Payload=json.dumps({"fix_job": result_id}).encode(),
        )
    else:
        threading.Thread(target=run_fix, args=(store, result_id), daemon=True).start()
    return {"id": result_id, "state": "running"}


def public_result(store, record: dict) -> dict:
    """Record -> the Result shape in docs/API.md (keys become URLs)."""
    files = record["files"]

    def visibility(entry):
        if not entry:
            return None
        return {"score": entry["score"], "grid_url": store.url(entry["grid"]), "saliency_url": store.url(entry["saliency"])}

    hidden = {"files", "gallery", "visibility_before", "visibility_after"}
    return {
        **{key: value for key, value in record.items() if key not in hidden},
        "visibility_before": visibility(record["visibility_before"]),
        "visibility_after": visibility(record["visibility_after"]),
        "images": {name: store.url(key) for name, key in files.items()},
    }


def gallery_items(store) -> list[dict]:
    return [
        {
            "id": record["id"],
            "filename": record["filename"],
            "score_before": record["before"]["score"],
            "score_after": record["after"]["score"] if record.get("after") else None,
            "state": record["state"],
            "thumb_url": store.url(record["files"].get("fixed") or record["files"]["original"]),
        }
        for record in store.gallery()
    ]
