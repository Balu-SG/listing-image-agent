# Listing Image Compliance Agent

An agent that makes product listing images marketplace-compliant and easier to spot in search,
without ever changing the product. OpenCV 5 does every check and every pixel edit; Claude on
Amazon Bedrock only plans which fixes to run and explains them.

Entry for the OpenCV AI Competition 2026 (powered by AWS).

## Status

- [x] Inspector: segmentation + 8 rules + score (`core/`)
- [ ] Fix tools + product-unchanged check
- [ ] Thumbnail visibility test
- [ ] Agent loop (Claude on Bedrock)
- [ ] AWS deployment (SAM) + web UI

## Quick start

```bash
uv sync
scripts/fetch_models.sh                                  # U^2-Net-p, PP-OCRv3 DB text detector, ESPCN x2
uv run python scripts/fetch_abo.py --count 60            # sample of Amazon Berkeley Objects main images
uv run python -m core.cli inspect data/abo/*.jpg --out out/abo   # JSON report + overlay per image
uv run pytest
```

## How the inspector works

1. **Segment** the product with U^2-Net-p through `cv2.dnn` (colour-distance fallback).
   A second, conservative **protect mask** adds any non-white pixels near the product
   (thin straps, ear loops, soft shadows); fixes will never touch it.
2. **Check** 8 rules from a YAML rule pack (`core/rulepacks/amazon.yaml`):

| Rule | Check | OpenCV technique |
| --- | --- | --- |
| R1 | Pure white background | Channel minimum over the background outside the protect mask |
| R2 | Product fills >= 85% | Mask bounding box vs frame |
| R3 | Resolution | Longest side; 2x ESPCN upscale counts as fixable |
| R4 | No added text or badges | PP-OCRv3 DB text detector (`TextDetectionModel_DB`); text on the product is allowed |
| R5 | No border | Line-by-line uniformity scan inward from each edge |
| R6 | Sharp | Variance of the Laplacian on the product region |
| R7 | Centred, not cut off | Mask touching the frame edge; bounding-box centre offset |
| R8 | Exposure | Product luminance mean and 99th percentile, ignoring filled-in holes |

3. **Score** 0-100: each rule earns its weight for PASS, half for FIXABLE, nothing for RESHOOT.

## Known limits

- A badge that touches the product (for example a "renewed" banner over the product's base) is merged into the
  product mask by U^2-Net, so its text counts as printed on the product.
- White products on white backgrounds are hard to segment; exposure is not judged for them.
- Thresholds are our reading of Amazon's style guide, not Amazon's algorithm.

## Data and models

- Amazon Berkeley Objects, CC BY 4.0 — https://amazon-berkeley-objects.s3.amazonaws.com/index.html
- U^2-Net-p (Apache-2.0), PP-OCRv3 text detection via OpenCV Zoo (Apache-2.0), ESPCN x2 (TF-ESPCN)
