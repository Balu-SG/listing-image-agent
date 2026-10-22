// In-browser fixtures used when VITE_MOCK=1. Simulates analyze -> fix -> polling,
// with agent steps appearing one by one. Every image is drawn on a canvas, so no
// external assets are needed.
import { ApiError } from './api';
import type { Gallery, GalleryItem, Health, Report, Result, RuleResult, Status, Step } from './types';

const SIZE = 800;
const STEP_INTERVAL_MS = 1700;

// ---------------------------------------------------------------- drawing

interface Scene {
  bg: string;
  border: boolean;
  badge: boolean;
  scale: number; // product height as fraction of frame
  offsetX: number; // fraction of frame
  hue: number;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  return [c, ctx];
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A stylised bottle. Returns its bounding box. */
function drawProduct(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number, hue: number) {
  const w = h * 0.42;
  const top = cy - h / 2;
  const capH = h * 0.12;
  const neckH = h * 0.08;
  const bodyTop = top + capH + neckH;
  const bodyH = h - capH - neckH;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath();
  ctx.ellipse(cx, top + h, w * 0.55, h * 0.03, 0, 0, Math.PI * 2);
  ctx.fill();
  // cap
  ctx.fillStyle = `hsl(${hue} 15% 20%)`;
  roundRect(ctx, cx - w * 0.22, top, w * 0.44, capH, w * 0.05);
  ctx.fill();
  // neck
  ctx.fillStyle = `hsl(${hue} 55% 38%)`;
  ctx.fillRect(cx - w * 0.16, top + capH, w * 0.32, neckH + 2);
  // body
  const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
  g.addColorStop(0, `hsl(${hue} 60% 32%)`);
  g.addColorStop(0.35, `hsl(${hue} 65% 52%)`);
  g.addColorStop(0.55, `hsl(${hue} 70% 62%)`);
  g.addColorStop(1, `hsl(${hue} 60% 30%)`);
  ctx.fillStyle = g;
  roundRect(ctx, cx - w / 2, bodyTop, w, bodyH, w * 0.18);
  ctx.fill();
  // label
  ctx.fillStyle = 'hsl(40 40% 96%)';
  roundRect(ctx, cx - w * 0.38, bodyTop + bodyH * 0.3, w * 0.76, bodyH * 0.38, w * 0.04);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue} 50% 30%)`;
  ctx.font = `600 ${Math.round(w * 0.13)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AURA', cx, bodyTop + bodyH * 0.45);
  ctx.fillStyle = `hsl(${hue} 20% 50%)`;
  ctx.fillRect(cx - w * 0.25, bodyTop + bodyH * 0.55, w * 0.5, Math.max(2, h * 0.008));
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, cx - w * 0.3, bodyTop + bodyH * 0.06, w * 0.07, bodyH * 0.85, w * 0.035);
  ctx.fill();
  return { x: cx - w / 2, y: top, w, h };
}

function drawScene(ctx: CanvasRenderingContext2D, size: number, s: Scene) {
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, size, size);
  const box = drawProduct(ctx, size / 2 + s.offsetX * size, size / 2, size * s.scale, s.hue);
  if (s.badge) {
    ctx.save();
    ctx.translate(size * 0.8, size * 0.17);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(size * 0.042)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('30%', 0, -size * 0.018);
    ctx.font = `700 ${Math.round(size * 0.026)}px system-ui, sans-serif`;
    ctx.fillText('OFF', 0, size * 0.025);
    ctx.restore();
  }
  if (s.border) {
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = size * 0.02;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, size - ctx.lineWidth, size - ctx.lineWidth);
  }
  return box;
}

function sceneImage(s: Scene, violations: boolean): string {
  const [c, ctx] = canvas(SIZE, SIZE);
  const box = drawScene(ctx, SIZE, s);
  if (violations) {
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const mark = (x: number, y: number, w: number, h: number, label: string, color: string) => {
      ctx.strokeStyle = color;
      ctx.strokeRect(x, y, w, h);
      const tw = ctx.measureText(label).width + 14;
      ctx.fillStyle = color;
      ctx.fillRect(x, Math.max(0, y - 30), tw, 28);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x + 7, Math.max(0, y - 30) + 4);
    };
    if (s.badge) mark(SIZE * 0.68, SIZE * 0.06, SIZE * 0.24, SIZE * 0.22, 'R4 badge', '#dc2626');
    if (s.scale < 0.8) mark(box.x - 10, box.y - 10, box.w + 20, box.h + 20, `R2 fill ${Math.round(s.scale * 100)}%`, '#d97706');
    if (s.bg !== '#ffffff') {
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(217,119,6,0.18)';
      ctx.fillRect(SIZE * 0.04, SIZE * 0.72, SIZE * 0.2, SIZE * 0.22);
      mark(SIZE * 0.04, SIZE * 0.72, SIZE * 0.2, SIZE * 0.22, 'R1 bg', '#d97706');
    }
    if (s.border) {
      ctx.setLineDash([]);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, SIZE - 6, SIZE - 6);
    }
  }
  return c.toDataURL('image/png');
}

function diffImage(s: Scene): string {
  const [c, ctx] = canvas(SIZE, SIZE);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, SIZE, SIZE);
  // faint outline of the product mask so viewers see where the check ran
  const h = SIZE * s.scale;
  const w = h * 0.42;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  roundRect(ctx, SIZE / 2 + s.offsetX * SIZE - w / 2, SIZE / 2 - h / 2, w, h, w * 0.18);
  ctx.stroke();
  return c.toDataURL('image/png');
}

const NEIGHBOUR_HUES = [210, 140, 30, 280, 0, 180, 60, 320];

function gridImage(s: Scene, saliency: boolean, strength: number): string {
  const cell = 220;
  const gap = 12;
  const n = 3;
  const total = n * cell + (n + 1) * gap;
  const [c, ctx] = canvas(total, total);
  ctx.fillStyle = saliency ? '#000' : '#f3f4f6';
  ctx.fillRect(0, 0, total, total);
  let k = 0;
  for (let r = 0; r < n; r += 1) {
    for (let col = 0; col < n; col += 1) {
      const x = gap + col * (cell + gap);
      const y = gap + r * (cell + gap);
      const isOurs = r === 1 && col === 1;
      if (saliency) {
        const intensity = isOurs ? strength : 0.35 + ((k * 37) % 30) / 100;
        const g = ctx.createRadialGradient(x + cell / 2, y + cell / 2, 4, x + cell / 2, y + cell / 2, cell * 0.55);
        const hot = (a: number) => `hsla(${Math.round(240 - 240 * intensity)} 100% 50% / ${a})`;
        g.addColorStop(0, hot(0.95));
        g.addColorStop(0.5, `hsla(${Math.round(240 - 160 * intensity)} 100% 45% / 0.6)`);
        g.addColorStop(1, 'rgba(0,0,80,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, cell, cell);
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, cell, cell);
        ctx.clip();
        ctx.translate(x, y);
        if (isOurs) {
          drawScene(ctx, cell, s);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, cell, cell);
          drawProduct(ctx, cell / 2, cell / 2, cell * (0.8 + ((k * 13) % 10) / 100), NEIGHBOUR_HUES[k % 8]);
        }
        ctx.restore();
        if (isOurs) {
          ctx.strokeStyle = '#4f46e5';
          ctx.lineWidth = 4;
          ctx.strokeRect(x - 2, y - 2, cell + 4, cell + 4);
        }
      }
      if (!isOurs) k += 1;
    }
  }
  return c.toDataURL('image/png');
}

// ---------------------------------------------------------------- fixtures

const RULE_NAMES: Record<string, string> = {
  R1: 'Pure white background',
  R2: 'Product fills at least 85% of frame',
  R3: 'Resolution at least 1000 px',
  R4: 'No added text, logos or badges',
  R5: 'No border',
  R6: 'Sharp focus',
  R7: 'Centred, not cut off',
  R8: 'Correct exposure',
};

function rule(id: string, status: Status, value: number, reason: string, fix_tools: string[] = []): RuleResult {
  return { rule_id: id, name: RULE_NAMES[id], status, value, reason, fix_tools, evidence: {} };
}

function report(score: number, rules: RuleResult[]): Report {
  const rank = { PASS: 0, FIXABLE: 1, RESHOOT: 2 } as const;
  const worst = rules.reduce<Status>((w, r) => (rank[r.status] > rank[w] ? r.status : w), 'PASS');
  return { score, status: worst, width: 2000, height: 2000, rules };
}

interface Fixture {
  scene: Scene;
  fixedScene: Scene;
  before: Report;
  after: Report;
  steps: Step[];
  summary: string;
  needs_reshoot: { rule_id: string; reason: string }[];
  vis: [number, number];
}

function fixtureA(): Fixture {
  const scene: Scene = { bg: '#e9e6df', border: true, badge: true, scale: 0.6, offsetX: 0.06, hue: 200 };
  const fixedScene: Scene = { bg: '#ffffff', border: false, badge: false, scale: 0.88, offsetX: 0, hue: 200 };
  const before = report(41, [
    rule('R1', 'FIXABLE', 0.62, 'Background averages RGB(233,230,223); 38% of background pixels are off-white.', ['whiten_background']),
    rule('R2', 'FIXABLE', 0.6, 'Product fills 60% of the longest side; Amazon requires at least 85%.', ['recrop_to_fill']),
    rule('R3', 'PASS', 1, 'Image is 2000 × 2000 px, above the 1000 px zoom threshold.'),
    rule('R4', 'FIXABLE', 0.3, 'A "30% OFF" promotional badge was detected in the top-right corner, outside the product.', ['inpaint_watermark']),
    rule('R5', 'FIXABLE', 0.2, 'A uniform 16 px grey frame surrounds the image.', ['remove_border']),
    rule('R6', 'PASS', 0.91, 'Edges are crisp (Laplacian variance 412, threshold 100).'),
    rule('R7', 'PASS', 0.84, 'Product is fully inside the frame and 6% off-centre horizontally.'),
    rule('R8', 'PASS', 0.88, 'Exposure is balanced; 0.2% of pixels clipped.'),
  ]);
  const after = report(96, [
    rule('R1', 'PASS', 1, 'Background is pure white RGB(255,255,255) outside the product mask.'),
    rule('R2', 'PASS', 0.88, 'Product fills 88% of the longest side.'),
    rule('R3', 'PASS', 1, 'Image is 2000 × 2000 px, above the 1000 px zoom threshold.'),
    rule('R4', 'PASS', 1, 'No text, logos or badges detected outside the product.'),
    rule('R5', 'PASS', 1, 'No border detected.'),
    rule('R6', 'PASS', 0.91, 'Edges are crisp (Laplacian variance 412, threshold 100).'),
    rule('R7', 'PASS', 0.98, 'Product is centred and fully inside the frame.'),
    rule('R8', 'PASS', 0.88, 'Exposure is balanced; 0.2% of pixels clipped.'),
  ]);
  const steps: Step[] = [
    {
      n: 1,
      tool: 'remove_border',
      input: { width_px: 16 },
      reason: 'R5 reports a uniform 16 px frame; remove it first so later background checks see the real edge.',
      outcome: 'applied',
      detail: 'Frame cropped and refilled with white; product pixels changed: 0',
      score_after: 52,
    },
    {
      n: 2,
      tool: 'inpaint_watermark',
      input: { region: [544, 48, 192, 176] },
      reason: 'The "30% OFF" badge sits outside the product mask, so it can be inpainted safely.',
      outcome: 'applied',
      detail: 'Badge region inpainted (Telea); product pixels changed: 0',
      score_after: 63,
    },
    {
      n: 3,
      tool: 'upscale',
      input: { factor: 2 },
      reason: 'Check whether more resolution would help zoom.',
      outcome: 'rejected',
      detail: 'Image is already 2000 px on the long side; R3 passes, so upscaling would add no detail.',
      score_after: null,
    },
    {
      n: 4,
      tool: 'whiten_background',
      input: { threshold: 235 },
      reason: 'Background is off-white beige; set everything outside the product mask to pure white.',
      outcome: 'applied',
      detail: '38% of pixels set to RGB(255,255,255); product pixels changed: 0',
      score_after: 79,
    },
    {
      n: 5,
      tool: 'recrop_to_fill',
      input: { target_fill: 0.88 },
      reason: 'Product fills only 60% of the frame; recrop around it to reach 88% and re-centre.',
      outcome: 'applied',
      detail: 'Cropped to product bbox + 6% margin and resampled to 2000 px; product pixels changed: 0',
      score_after: 94,
    },
    {
      n: 6,
      tool: 'pad_to_square',
      input: {},
      reason: 'Make sure the canvas is square with white padding.',
      outcome: 'applied',
      detail: 'Canvas already square after recrop; padded 0 px; product pixels changed: 0',
      score_after: 96,
    },
    {
      n: 7,
      tool: 'finish',
      input: {},
      reason: 'All eight rules now pass.',
      outcome: 'applied',
      detail: 'Done after 5 edits; final score 96.',
      score_after: 96,
    },
  ];
  return {
    scene,
    fixedScene,
    before,
    after,
    steps,
    summary:
      'I removed the grey frame and the "30% OFF" badge, whitened the beige background outside the product mask, and recropped so the bottle fills 88% of the frame. Upscaling was unnecessary. Every edit touched background pixels only: the product region is bit-identical to your upload.',
    needs_reshoot: [],
    vis: [38, 67],
  };
}

function fixtureB(): Fixture {
  const scene: Scene = { bg: '#dfe3e8', border: false, badge: false, scale: 0.7, offsetX: 0, hue: 150 };
  const fixedScene: Scene = { bg: '#ffffff', border: false, badge: false, scale: 0.87, offsetX: 0, hue: 150 };
  const before = report(48, [
    rule('R1', 'FIXABLE', 0.55, 'Background is light grey RGB(223,227,232).', ['whiten_background']),
    rule('R2', 'FIXABLE', 0.7, 'Product fills 70% of the longest side; Amazon requires at least 85%.', ['recrop_to_fill']),
    rule('R3', 'PASS', 1, 'Image is 1600 × 1600 px.'),
    rule('R4', 'PASS', 1, 'No text, logos or badges detected outside the product.'),
    rule('R5', 'PASS', 1, 'No border detected.'),
    rule('R6', 'RESHOOT', 0.28, 'Image is soft (Laplacian variance 41, threshold 100); sharpening would alter product pixels.'),
    rule('R7', 'PASS', 0.95, 'Product is centred and fully inside the frame.'),
    rule('R8', 'PASS', 0.8, 'Exposure is balanced.'),
  ]);
  const after = report(82, [
    ...before.rules.map((r) =>
      r.rule_id === 'R1'
        ? rule('R1', 'PASS', 1, 'Background is pure white outside the product mask.')
        : r.rule_id === 'R2'
          ? rule('R2', 'PASS', 0.87, 'Product fills 87% of the longest side.')
          : r,
    ),
  ]);
  return {
    scene,
    fixedScene,
    before,
    after,
    steps: [
      {
        n: 1,
        tool: 'whiten_background',
        input: {},
        reason: 'Grey studio sweep; whiten outside the mask.',
        outcome: 'applied',
        detail: 'product pixels changed: 0',
        score_after: 64,
      },
      {
        n: 2,
        tool: 'recrop_to_fill',
        input: { target_fill: 0.87 },
        reason: 'Fill is 70%; recrop to 87%.',
        outcome: 'applied',
        detail: 'product pixels changed: 0',
        score_after: 82,
      },
      {
        n: 3,
        tool: 'finish',
        input: {},
        reason: 'Sharpness cannot be fixed without editing the product.',
        outcome: 'applied',
        detail: 'Stopping; R6 needs a reshoot.',
        score_after: 82,
      },
    ],
    summary:
      'Background whitened and the product recropped to 87% fill. The photo is out of focus; sharpening would change product pixels, so I left it and flagged it for a reshoot.',
    needs_reshoot: [{ rule_id: 'R6', reason: 'Image is soft (Laplacian variance 41). Reshoot with a tripod and focus on the label.' }],
    vis: [44, 58],
  };
}

// ---------------------------------------------------------------- store

interface Entry {
  fixture: Fixture;
  result: Result;
  fixStartedAt: number | null;
  cache: Record<string, string>;
}

const store = new Map<string, Entry>();
let seeded = false;
let counter = 0;

function img(entry: Entry, key: string, make: () => string): string {
  if (!entry.cache[key]) entry.cache[key] = make();
  return entry.cache[key];
}

function create(fixture: Fixture, filename: string, createdAt: Date): Entry {
  counter += 1;
  const id = `mock-${counter.toString().padStart(3, '0')}`;
  const entry: Entry = { fixture, fixStartedAt: null, cache: {}, result: null as unknown as Result };
  const f = fixture;
  entry.result = {
    id,
    filename,
    created_at: createdAt.toISOString(),
    state: 'analyzed',
    planner: null,
    before: f.before,
    after: null,
    visibility_before: {
      score: f.vis[0],
      grid_url: img(entry, 'grid0', () => gridImage(f.scene, false, 0)),
      saliency_url: img(entry, 'sal0', () => gridImage(f.scene, true, f.vis[0] / 100)),
    },
    visibility_after: null,
    steps: [],
    summary: null,
    needs_reshoot: [],
    guarantee: null,
    images: {
      original: img(entry, 'orig', () => sceneImage(f.scene, false)),
      overlay: img(entry, 'over', () => sceneImage(f.scene, true)),
      fixed: null,
      fixed_overlay: null,
      diff: null,
    },
    error: null,
  };
  store.set(id, entry);
  return entry;
}

function complete(entry: Entry) {
  const f = entry.fixture;
  const r = entry.result;
  r.state = 'done';
  r.steps = f.steps;
  r.after = f.after;
  r.summary = f.summary;
  r.needs_reshoot = f.needs_reshoot;
  r.guarantee = { passed: true, changed_product_pixels: 0 };
  r.visibility_after = {
    score: f.vis[1],
    grid_url: img(entry, 'grid1', () => gridImage(f.fixedScene, false, 0)),
    saliency_url: img(entry, 'sal1', () => gridImage(f.fixedScene, true, f.vis[1] / 100)),
  };
  r.images.fixed = img(entry, 'fixed', () => sceneImage(f.fixedScene, false));
  r.images.fixed_overlay = img(entry, 'fixedOver', () => sceneImage(f.fixedScene, true));
  r.images.diff = img(entry, 'diff', () => diffImage(f.fixedScene));
}

function seed() {
  if (seeded) return;
  seeded = true;
  const now = Date.now();
  const a = create(fixtureA(), 'aura-serum-bottle.jpg', new Date(now - 3_600_000));
  complete(a);
  a.result.planner = 'claude';
  const b = create(fixtureB(), 'green-tonic-studio.jpg', new Date(now - 7_200_000));
  complete(b);
  b.result.planner = 'claude';
}

function snapshot(entry: Entry): Result {
  const r = entry.result;
  if (r.state === 'running' && entry.fixStartedAt !== null) {
    const elapsed = Date.now() - entry.fixStartedAt;
    const visible = Math.min(entry.fixture.steps.length, Math.floor(elapsed / STEP_INTERVAL_MS));
    r.steps = entry.fixture.steps.slice(0, visible);
    if (visible >= entry.fixture.steps.length && elapsed >= (visible + 0.6) * STEP_INTERVAL_MS) complete(entry);
  }
  return structuredClone(r);
}

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function need(id: string): Entry {
  const e = store.get(decodeURIComponent(id));
  if (!e) throw new ApiError(404, `Unknown result id: ${id}`);
  return e;
}

export async function mockRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  seed();
  await delay(method === 'POST' && path === '/api/analyze' ? 1400 : 250);
  let m: RegExpMatchArray | null;
  if (method === 'GET' && path === '/api/health') {
    return { ok: true, planner: 'claude', model: 'anthropic.claude (mock)' } satisfies Health as T;
  }
  if (method === 'POST' && path === '/api/analyze') {
    const { image_base64, filename } = (body ?? {}) as { image_base64?: string; filename?: string };
    if (!image_base64) throw new ApiError(400, 'image_base64 is required');
    if (filename?.toLowerCase().includes('limit')) throw new ApiError(429, 'Daily demo limit reached');
    const entry = create(fixtureA(), filename || 'upload.jpg', new Date());
    return snapshot(entry) as T;
  }
  if (method === 'POST' && (m = path.match(/^\/api\/fix\/(.+)$/))) {
    const entry = need(m[1]);
    if (entry.result.state === 'running') throw new ApiError(400, 'Fix already running');
    entry.result.state = 'running';
    entry.result.planner = 'claude';
    entry.result.steps = [];
    entry.fixStartedAt = Date.now();
    return { id: entry.result.id, state: 'running' } as T;
  }
  if (method === 'GET' && (m = path.match(/^\/api\/results\/(.+)$/))) {
    return snapshot(need(m[1])) as T;
  }
  if (method === 'GET' && path === '/api/gallery') {
    const items: GalleryItem[] = [...store.values()]
      .map((e) => e.result)
      .sort((x, y) => y.created_at.localeCompare(x.created_at))
      .map((r) => ({
        id: r.id,
        filename: r.filename,
        score_before: r.before.score,
        score_after: r.after?.score ?? null,
        state: r.state,
        thumb_url: r.images.fixed ?? r.images.original,
      }));
    return { items } satisfies Gallery as T;
  }
  throw new ApiError(404, `Mock has no route for ${method} ${path}`);
}
