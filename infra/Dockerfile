# Lambda container: OpenCV 5 (headless) + models + agent + API.
# Built by `sam build` from the repo root (see infra/template.yaml).
FROM public.ecr.aws/lambda/python:3.12

COPY infra/requirements.txt ${LAMBDA_TASK_ROOT}/requirements.txt
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

COPY core ${LAMBDA_TASK_ROOT}/core
COPY agent ${LAMBDA_TASK_ROOT}/agent
COPY api ${LAMBDA_TASK_ROOT}/api
COPY assets ${LAMBDA_TASK_ROOT}/assets
COPY models ${LAMBDA_TASK_ROOT}/models

ENV MODELS_DIR=${LAMBDA_TASK_ROOT}/models \
    OPENCV_LOG_LEVEL=ERROR

CMD ["api.lambda_handler.handler"]
