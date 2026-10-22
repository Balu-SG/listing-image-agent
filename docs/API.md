# API contract

Base path `/api`. Same routes locally (FastAPI on :8000) and on AWS (API Gateway HTTP API -> Lambda).
All bodies are JSON. Image URLs in responses are ready to use in `<img src>` (relative `/api/files/...`
locally, presigned S3 URLs on AWS).

## Types

```ts
type Status = "PASS" | "FIXABLE" | "RESHOOT";

interface RuleResult {
  rule_id: string;            // "R1".."R8"
  name: string;               // "Pure white background"
  status: Status;
  value: number;              // 0..1
  reason: string;             // human sentence
  fix_tools: string[];
  evidence: Record<string, unknown>;
}

interface Report {
  score: number;              // 0..100
  status: Status;             // worst rule status
  width: number;
  height: number;
  rules: RuleResult[];
}

interface Visibility {
  score: number;              // 0..100, 50 = average for the grid
  grid_url: string;           // image: the product as a search thumbnail among 8 neighbours
  saliency_url: string;       // image: saliency heat map of that grid
}

interface Step {
  n: number;                  // 1-based
  tool: string;               // "whiten_background" | "recrop_to_fill" | "pad_to_square" | "remove_border" | "inpaint_watermark" | "upscale" | "finish"
  input: Record<string, unknown>;
  reason: string;             // planner's one-line reason
  outcome: "applied" | "rejected" | "error";
  detail: string;             // e.g. "product pixels changed: 0" or why rejected
  score_after: number | null;
}

interface Result {
  id: string;
  filename: string;
  created_at: string;         // ISO
  state: "analyzed" | "running" | "done" | "error";
  planner: "claude" | "rules" | null;
  before: Report;
  after: Report | null;
  visibility_before: Visibility;
  visibility_after: Visibility | null;
  steps: Step[];              // grows while state == "running"
  summary: string | null;     // planner's explanation, set when done
  needs_reshoot: { rule_id: string; reason: string }[];
  guarantee: { passed: boolean; changed_product_pixels: number; psnr_db: number | null } | null;
  // psnr_db is set only when the image was upscaled: the result is shrunk back and compared with the
  // original (round trip); changed_product_pixels then counts resampling differences > 24 levels.
  images: {
    original: string;
    overlay: string;          // violations drawn on the original
    fixed: string | null;
    fixed_overlay: string | null;
    diff: string | null;      // product-region difference map (black = unchanged)
  };
  error: string | null;
}
```

## Routes

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| GET | `/api/health` | | `{ ok: true, planner: "claude" \| "rules", model: string \| null }` |
| POST | `/api/analyze` | `{ image_base64: string, filename: string }` (JPEG/PNG, <= 4.5 MB decoded; the UI downsizes to 2000px long side first) | `Result` with `state: "analyzed"` |
| POST | `/api/fix/{id}` | `{}` | `202 { id, state: "running" }` |
| GET | `/api/results/{id}` | | `Result` (poll every ~1.5 s while `state == "running"`) |
| GET | `/api/gallery` | | `{ items: { id, filename, score_before, score_after, state, thumb_url }[] }` |

Errors: `{ detail: string }` with 400 (bad image), 404 (unknown id), 413 (too large),
429 (`detail: "Daily demo limit reached"`).
