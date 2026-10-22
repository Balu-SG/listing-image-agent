#!/usr/bin/env bash
# Two-phase deploy to the account's region (ap-southeast-2, Sydney).
#
#   ALERT_EMAIL=you@example.com scripts/deploy.sh preview   # build + show every change; only uploads build
#                                                           # artifacts (container image to ECR, SAM's bucket)
#   ALERT_EMAIL=you@example.com scripts/deploy.sh apply     # build + deploy + publish the web UI
#
# Needs: AWS CLI (aws login), SAM CLI, Docker, Node.
set -euo pipefail
cd "$(dirname "$0")/.."
MODE=${1:?usage: scripts/deploy.sh preview|apply}
STACK=${STACK:-listing-image-agent}
REGION=${REGION:-ap-southeast-2}
: "${ALERT_EMAIL:?set ALERT_EMAIL for the budget alert}"

scripts/fetch_models.sh
uv export --no-dev --no-hashes --format requirements-txt > infra/requirements.txt
sam build --template-file infra/template.yaml

DEPLOY_ARGS=(
  --stack-name "$STACK" --region "$REGION"
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM
  --resolve-s3 --resolve-image-repos
  --parameter-overrides "AlertEmail=$ALERT_EMAIL"
  --no-fail-on-empty-changeset
)

if [[ $MODE == preview ]]; then
  sam deploy "${DEPLOY_ARGS[@]}" --no-execute-changeset
  echo "Preview only: no app resources were created (build artifacts were uploaded). Run with 'apply' to deploy."
  exit 0
fi

sam deploy "${DEPLOY_ARGS[@]}" --no-confirm-changeset

output() { aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
API_URL=$(output ApiUrl)
WEB_BUCKET=$(output WebBucketName)
WEB_URL=$(output WebUrl)

(cd web && npm ci && VITE_API_BASE="$API_URL" npm run build)
aws s3 sync web/dist "s3://$WEB_BUCKET" --delete --region "$REGION"

echo "API: $API_URL"
echo "Web: $WEB_URL"
