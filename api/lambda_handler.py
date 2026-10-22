"""AWS Lambda entry point: API Gateway events go to FastAPI via Mangum; {"fix_job": id}
events (asynchronous self-invocation) run the agent."""

from mangum import Mangum

from api import service
from api.app import app, store

http_handler = Mangum(app, lifespan="off")


def handler(event, context):
    if isinstance(event, dict) and "fix_job" in event:
        service.run_fix(store, event["fix_job"])
        return {"ok": True}
    if isinstance(event, dict) and event.get("warmup"):
        return {"ok": True}  # scheduled ping keeps a container warm during judging
    return http_handler(event, context)
