# Listing Image Compliance Agent: web UI

Vite + React 18 + TypeScript + Tailwind CSS v4. Talks to the API described in `../docs/API.md`.

## Commands

```bash
npm install

npm run dev          # http://localhost:5173, proxies /api -> http://localhost:8000 (backend must be running)
npm run dev:mock     # same, but the API is served from in-browser fixtures (no backend needed)
npm run build        # type-check (tsc -b) + production build into dist/
npm run build:mock   # production build with mock data baked in (for a static demo)
npm run preview      # serve dist/ locally
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_BASE` | `''` | Prefix for API calls. Paths already start with `/api`, so set this to the API Gateway origin in production, e.g. `VITE_API_BASE=https://abc123.execute-api.us-east-1.amazonaws.com npm run build`. Relative image URLs (`/api/files/...`) get the same prefix; absolute (presigned S3) URLs are used as-is. |
| `VITE_MOCK` | unset | `1` serves every route from `src/mock.ts`. |

## Mock mode

- The gallery is seeded with two finished results (one ending PASS, one with a "Needs reshoot" item).
- Uploading any JPEG/PNG returns the same canvas-drawn sample (off-white background, grey border, "30% OFF" badge, low fill).
- "Fix with agent" reveals one agent step every ~1.7 s through the normal 1.5 s polling loop, including a rejected step.
- Upload a file whose name contains `limit` to see the 429 "Daily demo limit reached" message.

## Layout

```
src/
  api.ts            fetch client, error mapping, asset URL helper
  types.ts          types copied from docs/API.md
  image.ts          client-side downscale (2000 px long side, JPEG q=0.92) -> base64
  mock.ts           in-browser fixtures (only bundled when VITE_MOCK=1)
  App.tsx           tabs, upload, polling, hash deep links (#/results/<id>, #/gallery)
  components/       Header, Uploader, ResultView, RulesList, AgentTimeline,
                    CompareSlider, ProofCard, VisibilityCard, Gallery, Footer, ...
```
