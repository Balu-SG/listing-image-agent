"""Lazy loaders for the pretrained OpenCV DNN models in models/."""

import os
from functools import cache
from pathlib import Path

import cv2

MODELS_DIR = Path(os.environ.get("MODELS_DIR", Path(__file__).resolve().parent.parent / "models"))


def model_path(name: str) -> Path:
    path = MODELS_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"{path} missing; run scripts/fetch_models.sh")
    return path


@cache
def u2netp() -> cv2.dnn.Net:
    return cv2.dnn.readNet(str(model_path("u2netp.onnx")))


@cache
def text_detector() -> cv2.dnn.TextDetectionModel_DB:
    detector = cv2.dnn.TextDetectionModel_DB(str(model_path("text_detection_ppocrv3_en.onnx")))
    detector.setBinaryThreshold(0.3)
    detector.setPolygonThreshold(0.5)
    detector.setMaxCandidates(200)
    detector.setUnclipRatio(2.0)
    return detector


@cache
def super_res_x2() -> cv2.dnn_superres.DnnSuperResImpl:
    upscaler = cv2.dnn_superres.DnnSuperResImpl_create()
    upscaler.readModel(str(model_path("ESPCN_x2.pb")))
    upscaler.setModel("espcn", 2)
    return upscaler
