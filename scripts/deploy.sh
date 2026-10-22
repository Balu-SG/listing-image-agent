#!/usr/bin/env bash
# Build and deploy the stack, then the web UI. Needs: AWS CLI, SAM CLI, Docker, Node, and
# Bedrock model access for Claude in BEDROCK_REGION.
#
#   ALERT_EMAIL=you@example.com scripts/deploy.sh            # first deploy (guided)
#   scripts/deploy.sh                                        # later deploys
set -euo pipefail
cd "$(dirname "$0")/.."
STACK=${STACK:-listing-image-agent}

scripts/fetch_models.sh
uv export --no-dev --no-hashes --format requirements-txt > infra/requirements.txt

sam build --template-file infra/template.yaml
if [[ -f samconfig.toml ]]; then
  sam deploy
else
  sam deploy --guided --stack-name "$STACK" --capabilities CAPABILITY_IAM \
    --parameter-overrides "AlertEmail=${ALERT_EMAIL:?set ALERT_EMAIL for the budget alert}"
fi

output() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
API_URL=$(output ApiUrl)
WEB_BUCKET=$(output WebBucketName)
WEB_URL=$(output WebUrl)

(cd web && npm ci && VITE_API_BASE="$API_URL" npm run build)
aws s3 sync web/dist "s3://$WEB_BUCKET" --delete

echo "API: $API_URL"
echo "Web: $WEB_URL"
