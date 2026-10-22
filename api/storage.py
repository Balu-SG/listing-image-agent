"""Where results and images live: local disk for development, S3 + DynamoDB on AWS.

Results store image KEYS, never URLs; URLs are made when a result is read (presigned on S3).
"""

import datetime as dt
import json
import os
import threading
from decimal import Decimal
from pathlib import Path
from urllib.parse import quote

import cv2
import numpy as np


def encode_image(image: np.ndarray, lossless: bool) -> tuple[bytes, str]:
    if lossless:
        ok, data = cv2.imencode(".png", image, [cv2.IMWRITE_PNG_COMPRESSION, 6])
        return data.tobytes(), "png"
    ok, data = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return data.tobytes(), "jpg"


def today() -> str:
    return dt.datetime.now(dt.UTC).strftime("%Y-%m-%d")


class LocalStore:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def put_image(self, result_id: str, name: str, image: np.ndarray, lossless: bool = False) -> str:
        data, extension = encode_image(image, lossless)
        key = f"{result_id}/{name}.{extension}"
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def url(self, key: str | None, download_name: str | None = None) -> str | None:
        if not key:
            return None
        return f"/api/files/{key}" + (f"?download={quote(download_name)}" if download_name else "")

    def file_path(self, key: str) -> Path | None:
        path = (self.root / key).resolve()
        return path if path.is_file() and self.root.resolve() in path.parents else None

    def save_result(self, record: dict) -> None:
        with self._lock:
            path = self.root / record["id"] / "result.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(record))

    def get_result(self, result_id: str) -> dict | None:
        path = self.root / result_id / "result.json"
        return json.loads(path.read_text()) if path.is_file() else None

    def gallery(self) -> list[dict]:
        records = (json.loads(path.read_text()) for path in self.root.glob("*/result.json"))
        return sorted((record for record in records if record.get("gallery")), key=lambda record: record["created_at"])

    def count_today(self, name: str) -> int:
        """Increment and return today's counter (used for the demo's daily Claude cap)."""
        with self._lock:
            path = self.root / f"counter-{name}-{today()}.txt"
            value = int(path.read_text()) + 1 if path.exists() else 1
            path.write_text(str(value))
            return value


def _to_dynamo(value):
    return json.loads(json.dumps(value), parse_float=Decimal)


def _from_dynamo(value):
    return json.loads(json.dumps(value, default=lambda number: float(number) if number % 1 else int(number)))


class AwsStore:
    def __init__(self, bucket: str, table: str):
        import boto3  # only needed on AWS

        self.bucket = bucket
        self.s3 = boto3.client("s3")
        self.table = boto3.resource("dynamodb").Table(table)

    def put_image(self, result_id: str, name: str, image: np.ndarray, lossless: bool = False) -> str:
        data, extension = encode_image(image, lossless)
        key = f"results/{result_id}/{name}.{extension}"
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=f"image/{'png' if lossless else 'jpeg'}")
        return key

    def url(self, key: str | None, download_name: str | None = None) -> str | None:
        if not key:
            return None
        params = {"Bucket": self.bucket, "Key": key}
        if download_name:
            params["ResponseContentDisposition"] = f'attachment; filename="{download_name}"'
        return self.s3.generate_presigned_url("get_object", Params=params, ExpiresIn=6 * 3600)

    def file_path(self, key: str) -> Path | None:
        return None

    def save_result(self, record: dict) -> None:
        self.table.put_item(Item=_to_dynamo({"pk": f"result#{record['id']}", **record}))

    def get_result(self, result_id: str) -> dict | None:
        item = self.table.get_item(Key={"pk": f"result#{result_id}"}).get("Item")
        if not item:
            return None
        item = _from_dynamo(item)
        item.pop("pk", None)
        return item

    def gallery(self) -> list[dict]:
        from boto3.dynamodb.conditions import Attr

        items = self.table.scan(FilterExpression=Attr("gallery").eq(True)).get("Items", [])
        records = [_from_dynamo(item) for item in items]
        return sorted(records, key=lambda record: record["created_at"])

    def count_today(self, name: str) -> int:
        response = self.table.update_item(
            Key={"pk": f"counter#{name}#{today()}"},
            UpdateExpression="ADD #count :one",
            ExpressionAttributeNames={"#count": "count"},
            ExpressionAttributeValues={":one": 1},
            ReturnValues="UPDATED_NEW",
        )
        return int(response["Attributes"]["count"])


def make_store():
    bucket, table = os.environ.get("RESULTS_BUCKET"), os.environ.get("RESULTS_TABLE")
    if bucket and table:
        return AwsStore(bucket, table)
    return LocalStore(Path(os.environ.get("LOCAL_STORE", "out/store")))
