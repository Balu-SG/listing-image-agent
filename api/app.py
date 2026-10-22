"""FastAPI routes (contract: docs/API.md).

Local: uv run uvicorn api.app:app --port 8000
"""

import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from api import service
from api.storage import make_store
from core.explain import meta as explain_meta

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Listing Image Compliance Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)
store = make_store()


class AnalyseBody(BaseModel):
    image_base64: str
    filename: str = "upload.jpg"


@app.exception_handler(service.ApiError)
async def api_error(request: Request, error: service.ApiError) -> JSONResponse:
    return JSONResponse({"detail": error.detail}, status_code=error.status)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "planner": service.planner_setting(), "model": service.model_setting()}


@app.get("/api/meta")
def meta() -> dict:
    """Explanations for every rule, tool and metric (tooltips and help panels)."""
    return explain_meta()


@app.post("/api/analyze")
def analyse(body: AnalyseBody) -> dict:
    record = service.analyse(store, body.image_base64, body.filename)
    return service.public_result(store, record)


class AnalyseUrlBody(BaseModel):
    url: str


@app.post("/api/analyze-url")
def analyse_url(body: AnalyseUrlBody) -> dict:
    record = service.analyse_url(store, body.url)
    return service.public_result(store, record)


@app.post("/api/fix/{result_id}", status_code=202)
def fix(result_id: str) -> dict:
    return service.start_fix(store, result_id)


@app.get("/api/results/{result_id}")
def result(result_id: str) -> dict:
    record = store.get_result(result_id)
    if record is None:
        raise HTTPException(404, "Unknown result id")
    return service.public_result(store, record)


@app.get("/api/gallery")
def gallery() -> dict:
    return {"items": service.gallery_items(store)}


@app.get("/api/files/{key:path}")
def files(key: str, download: str | None = None) -> FileResponse:
    path = store.file_path(key)
    if path is None:
        raise HTTPException(404, "Not found")
    headers = {"Cache-Control": "public, max-age=86400"}
    if download:  # served as an attachment with this filename
        return FileResponse(path, headers=headers, filename=Path(download).name)
    return FileResponse(path, headers=headers)
