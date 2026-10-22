# Listing Image Compliance Agent

An agent that makes product listing main images marketplace-compliant and easier to spot in
search, **without ever changing the product**. OpenCV 5 does every check and every pixel edit;
Claude on Amazon Bedrock only plans which fixes to run and explains them to the seller. Every
edit is verified against the original product pixels before it is kept.

Entry for the OpenCV AI Competition 2026 (powered by AWS).

## How it works

1. **Segment.** On a plain backdrop the background is found by flood-filling inward from the image
   edges in small colour steps, with Canny edges acting as walls. Everything the flood cannot reach
   is product, so printed labels, thin straps and holes inside the product are kept. Lifestyle
   (scene) photos fall back to U^2-Net-p through `cv2.dnn` for measuring only; their background is
   never edited. Separate pieces mostly covered by detected text (badges, watermarks) are overlays,
   not product.
2. **Inspect** 8 rules from a YAML rule pack (`core/rulepacks/amazon.yaml`), score 0-100. The rules
   follow Amazon's official
   [Product image requirements (Seller Central G1881)](https://sellercentral.amazon.com/help/hub/reference/external/G1881),
   read on 22 Oct 2026; each threshold in the rule pack is marked as Amazon's or ours.
3. **Plan.** Claude receives the inspection JSON (never pixels) and calls fix tools. A deterministic
   rule planner does the same offline, when the demo budget is spent, or if Claude declines.
4. **Fix and verify.** Each tool is a deterministic OpenCV operation. Before a result is kept the
   session checks that **no product pixel changed** (exact comparison after mapping the original
   product region through the crop/pad transform) and that the score did not drop. Rejected calls
   are reported back to the planner. Images are never enlarged: Amazon says "Do not artificially
   enlarge small images."
5. **Search visibility.** The image is shrunk to a mobile search tile among 8 neighbour products
   and scored with spectral-residual saliency (50 = average share of attention).

| Rule | Amazon says | OpenCV technique | Fix |
| --- | --- | --- | --- |
| R1 | "pure white background (RGB 255, 255, 255)" | Channel minimum over the flood-filled backdrop | `whiten_background` |
| R2 | "Show the product as 85% of the image" | Product bounding box vs frame (longest side) | `recrop_to_fill` |
| R3 | 500 px minimum, 10,000 max; 1,000+ enables zoom; "do not artificially enlarge" | Longest side | reshoot (never enlarged) |
| R4 | "No text or pricing details"; no badges such as "Best seller" | PP-OCRv3 DB detector (`TextDetectionModel_DB`) + flat-badge test | `inpaint_watermark` (`cv2.inpaint`) |
| R5 | (derived) a border is non-white background | Line-by-line uniformity scan from each edge | `remove_border` |
| R6 | "Clear, non-pixelated, no jagged edges" | Variance of the Laplacian on the product | reshoot |
| R7 | "Do not cut off any part of the product" | Product touching the frame edge (centring = advice only) | reshoot |
| R8 | (derived) "accurately represent the ... color" | Product brightness mean and 99th percentile | reshoot |

Not checked automatically: one unit only, props, mannequins, footwear angle, packaging, product
shown once. `pad_to_square` is our choice (square thumbnails), not an Amazon rule.

## Results on 60 Amazon Berkeley Objects main images (rule planner)

- Product-unchanged check passed on **60 / 60** images.
- Average score **94 -> 99**; 56 of 60 reach 100.
- ~0.3 s per inspection, ~1 s per analysis inside the Lambda container (arm64, 3 GB).

Per-rule precision/recall against hand labels: _pending — `eval/labels.csv`_.

## Run locally

```bash
uv sync
scripts/fetch_models.sh                                   # U^2-Net-p, PP-OCRv3 DB
uv run python scripts/fetch_abo.py --count 60             # sample of ABO main images
uv run pytest                                             # 23 tests, offline

uv run python -m core.cli inspect data/abo/*.jpg --out out/abo       # reports + overlays
uv run python -m agent.cli data/abo/*.jpg --out out/fixed            # fix with the rule planner

uv run uvicorn api.app:app --port 8000                    # API (docs/API.md)
(cd web && npm install && npm run dev)                    # UI on http://localhost:5173
uv run python scripts/build_gallery.py data/abo/91wf28y8wLL.jpg ...  # precomputed examples
```

Use Claude as the planner: `PLANNER=claude AGENT_BACKEND=bedrock BEDROCK_REGION=us-east-1` (AWS
credentials with Bedrock access) or `AGENT_BACKEND=anthropic` with `ANTHROPIC_API_KEY`.
`AGENT_MODEL` defaults to `claude-opus-5-5`; `AGENT_EFFORT` defaults to `low`.

## Deploy to AWS

Needs AWS CLI, SAM CLI, Docker, Node and Bedrock model access for Claude.

```bash
ALERT_EMAIL=you@example.com scripts/deploy.sh
```

| Piece | Service |
| --- | --- |
| Inspector, fix tools, agent loop | Lambda (container image in ECR, arm64, 3 GB) |
| Planner | Claude on Amazon Bedrock |
| API | API Gateway HTTP API (5 req/s, burst 10) -> Lambda |
| Fix jobs | Asynchronous Lambda self-invocation; the UI polls |
| Images | S3 (30-day expiry), served by presigned URL |
| Results, daily counters | DynamoDB (on demand) |
| Web UI | S3 + CloudFront |
| Cost guard | AWS Budgets ($20/month alert), reserved concurrency 5, daily Claude cap |

## Known limits

- A badge that touches the product (e.g. a "renewed" banner over its base) merges with the product.
- A lifestyle photo with a large plain wall can pass as a studio shot; props stay as "product".
- White products on white backdrops: exposure is not judged.
- Amazon's rules are quoted from its help page; the measurement thresholds are ours, not Amazon's internal checks.

## Credits

- Amazon Berkeley Objects, CC BY 4.0 — sample and neighbour images.
- U^2-Net-p (Apache-2.0), PP-OCRv3 text detection via OpenCV Zoo (Apache-2.0).
