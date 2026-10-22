// In-browser fixtures used when VITE_MOCK=1. Simulates analyze -> fix -> polling,
// with agent steps appearing one by one. Every image is drawn on a canvas, so no
// external assets are needed.
import { ApiError } from './api';
import type { Gallery, GalleryItem, Guarantee, Health, Meta, Report, Result, RuleResult, Status, Step } from './types';

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
  R2: 'Product fills 85% of the image',
  R3: 'Image size',
  R4: 'No added text or badges',
  R5: 'No border or frame',
  R6: 'Sharp, in focus',
  R7: 'Whole product in frame',
  R8: 'Exposure',
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
  guarantee: Guarantee;
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
      tool: 'pad_to_square',
      input: {},
      reason: 'Try squaring the canvas before whitening.',
      outcome: 'rejected',
      detail: 'rejected: score would drop 63 -> 60',
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
      'I removed the grey frame and the "30% OFF" badge, whitened the beige background outside the product mask, and recropped so the bottle fills 88% of the frame. Every edit touched background pixels only: the product region is bit-identical to your upload.',
    needs_reshoot: [],
    vis: [38, 67],
    guarantee: { passed: true, changed_product_pixels: 0, product_pixels: 241_388, psnr_db: null },
  };
}

function fixtureB(): Fixture {
  const scene: Scene = { bg: '#dfe3e8', border: false, badge: false, scale: 0.7, offsetX: 0, hue: 150 };
  const fixedScene: Scene = { bg: '#ffffff', border: false, badge: false, scale: 0.87, offsetX: 0, hue: 150 };
  const before = report(48, [
    rule('R1', 'FIXABLE', 0.55, 'Background is light grey RGB(223,227,232).', ['whiten_background']),
    rule('R2', 'FIXABLE', 0.7, 'Product fills 70% of the longest side; Amazon requires at least 85%.', ['recrop_to_fill']),
    { ...rule('R3', 'PASS', 1, 'Longest side is 900 px: accepted, but zoom needs 1,000+ px.'), evidence: { width: 900, height: 900, zoom: false } },
    rule('R4', 'PASS', 1, 'No text, logos or badges detected outside the product.'),
    rule('R5', 'FIXABLE', 0.4, 'Thin 6 px frame along the bottom edge.', ['remove_border']),
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
    needs_reshoot: [
      { rule_id: 'R6', reason: 'Image is soft (Laplacian variance 41). Reshoot with a tripod and focus on the label.' },
      { rule_id: 'R5', reason: 'Not fixed automatically (the border touches the product). Thin 6 px frame along the bottom edge.' },
    ],
    vis: [44, 58],
    guarantee: { passed: true, changed_product_pixels: 0, product_pixels: 338_623, psnr_db: null },
  };
}

// ---------------------------------------------------------------- meta (mirrors GET /api/meta)

const META: Meta = {
  "marketplace": "amazon",
  "source": {
    "title": "Amazon Seller Central: Product image requirements (G1881)",
    "url": "https://sellercentral.amazon.com/help/hub/reference/external/G1881",
    "read_on": "2026-10-22"
  },
  "not_checked": [
    "Only one unit of the product, plus accessories included with it",
    "No props that are not included with the product",
    "No mannequins; clothing in adult sizes on a standing model",
    "Footwear: a single shoe facing left at a 45-degree angle",
    "No packaging unless it is an important product feature",
    "Product shown only once (not front and back together)"
  ],
  "overlay_legend": [
    {
      "colour": "#1478d2",
      "label": "Protected product outline"
    },
    {
      "colour": "#eb9600",
      "label": "To change: off-white backdrop, or product too small"
    },
    {
      "colour": "#dc2626",
      "label": "To remove or reshoot: added text, border, cut-off edge"
    }
  ],
  "rules": {
    "R1": {
      "title": "Pure white background",
      "basis": "amazon",
      "amazon": "Have a pure white background (RGB color values: 255, 255, 255). Only a limited number of product types are allowed to have a lifestyle image as a main image.",
      "what": "The backdrop around the product must be pure white (RGB 255, 255, 255).",
      "why": "Amazon requires it so search and product pages look consistent; a main image that breaks the rules can get the listing removed from search.",
      "how": "We find the backdrop by flood-filling inward from the image edges, then count how much of it is exactly 255 (at least 98%, our threshold). Lifestyle photos are flagged for a reshoot; most product types may not use one.",
      "fix": "whiten_background"
    },
    "R2": {
      "title": "Product fills 85% of the image",
      "basis": "amazon",
      "amazon": "Show the product as 85% of the image.",
      "what": "The product should take up 85% of the image.",
      "why": "Amazon's requirement; a small product also looks weak as a search thumbnail.",
      "how": "We measure the product's longest side against the image (our reading of \"85% of the image\").",
      "fix": "recrop_to_fill"
    },
    "R3": {
      "title": "Image size",
      "basis": "amazon",
      "amazon": "Minimum 500 pixels and maximum 10,000 pixels on the longest side. Images with 1,000+ pixels on the longest side enable the zoom function. Do not artificially enlarge small images.",
      "what": "Longest side between 500 and 10,000 px; 1,000+ px recommended for zoom.",
      "why": "Amazon rejects images outside that range; 1,000+ px enables zoom on the product page.",
      "how": "We read the image size. Under 1,000 px passes with a zoom note. We never enlarge images, because Amazon says not to.",
      "fix": null
    },
    "R4": {
      "title": "No added text or badges",
      "basis": "amazon",
      "amazon": "No text or pricing details. No badges used on Amazon, or variations, such as \"Amazon's Choice\", \"Best seller\" or \"Top seller\". No Amazon logos or trademarks.",
      "what": "No text, prices, badges, logos or watermarks added on top of the photo.",
      "why": "Amazon prohibits them on product images. Text printed on the product's own packaging is part of the product.",
      "how": "OpenCV's DB text detector finds text; text inside the product outline counts as packaging, text or flat badges on the backdrop count as added.",
      "fix": "inpaint_watermark"
    },
    "R5": {
      "title": "No border or frame",
      "basis": "derived",
      "amazon": null,
      "what": "No coloured border or frame around the image.",
      "why": "Amazon's page does not name borders, but a border is non-white background, which the pure-white rule does not allow.",
      "how": "We scan inward from each edge, line by line, for a uniform band that differs from what lies inside it.",
      "fix": "remove_border"
    },
    "R6": {
      "title": "Sharp, in focus",
      "basis": "amazon",
      "amazon": "Clear, non-pixelated, no jagged edges. Accurately represent the product as a realistic, professional-quality image.",
      "what": "The product must be in focus.",
      "why": "Amazon's image quality requirement; blurry photos also lose clicks.",
      "how": "Variance of the Laplacian (edge strength) on the product; below 60 counts as blurry (our threshold).",
      "fix": null
    },
    "R7": {
      "title": "Whole product in frame",
      "basis": "amazon",
      "amazon": "Show the entire product within the frame of the image. Do not cut off any part of the product.",
      "what": "No part of the product may be cut off by the image edge.",
      "why": "Amazon's requirement. Centring is our advice only: it is shown as a note and never lowers the score.",
      "how": "We check whether the product runs into the image edge. We also note when its centre is more than 8% off (advice).",
      "fix": null
    },
    "R8": {
      "title": "Exposure",
      "basis": "derived",
      "amazon": "The image should accurately represent the real scale, quantity, and color of the product.",
      "what": "The product is neither washed out nor underexposed.",
      "why": "Bad exposure misrepresents the product's colour, which Amazon's accuracy requirement covers.",
      "how": "Our check: the product's average brightness must not be too high (washed out), and it must have some bright highlights (not underexposed).",
      "fix": null
    }
  },
  "weights": {
    "R1": 3,
    "R2": 2,
    "R3": 1,
    "R4": 3,
    "R5": 1,
    "R6": 2,
    "R7": 2,
    "R8": 1
  },
  "tools": {
    "whiten_background": {
      "label": "Whiten background",
      "what": "Sets every backdrop pixel to pure white, with a soft 3 px edge so the product does not look cut out.",
      "safety": "Only pixels outside the protected product area change."
    },
    "recrop_to_fill": {
      "label": "Reframe to fill",
      "what": "Crops to a square around the product so it fills about 87% of the frame, which also centres it.",
      "safety": "The frame always contains the whole product; pixels are moved, never altered."
    },
    "pad_to_square": {
      "label": "Pad to square",
      "what": "Adds white space to make the image square, so it fills a square search tile without letterboxing (our choice; Amazon does not require square).",
      "safety": "Only new white pixels are added."
    },
    "remove_border": {
      "label": "Remove border",
      "what": "Paints a detected border or frame white.",
      "safety": "Refuses if the border touches the product."
    },
    "inpaint_watermark": {
      "label": "Remove text or badge",
      "what": "Fills in text, badges or watermarks on the backdrop using OpenCV inpainting.",
      "safety": "Only runs on the backdrop; text printed on the product is never touched."
    },
    "finish": {
      "label": "Finish",
      "what": "The planner stops and writes its summary.",
      "safety": ""
    }
  },
  "metrics": {
    "score": "Compliance score from 0 to 100. Each rule has a weight; a passing rule earns its full weight, a fixable one half, a reshoot none.",
    "status": {
      "PASS": "Meets the rule.",
      "FIXABLE": "Breaks the rule, but the agent can fix it without touching the product.",
      "RESHOOT": "Breaks the rule in a way editing cannot fix; a new photo is needed."
    },
    "visibility": "How much your image stands out as a search thumbnail. We place it among 8 other products and measure where the eye is drawn (spectral-residual saliency). 50 means an average share of attention; 100 means twice its share or more.",
    "guarantee": "After every edit we map the original product pixels onto the new image and compare them one by one. Any edit that changes even one product pixel is rejected. Edits only change the backdrop or move the canvas (crop, pad); the product is never resampled or enlarged.",
    "diff_map": "Grey is the product region that was compared; red would mark any product pixel that changed. Black is background.",
    "planner": {
      "claude": "Claude on Amazon Bedrock reads the inspection report (not the image) and decides which tools to run, in what order.",
      "rules": "A fixed rule-based planner chooses the tools. Used offline, as a fallback, or when the demo's daily Claude budget is used up."
    },
    "segmentation": {
      "studio": "Plain backdrop found: the product outline is reliable, so the backdrop can be edited.",
      "scene": "Lifestyle or scene photo: the product outline is uncertain, so nothing is edited."
    }
  }
};

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
    current_step: null,
    summary: null,
    needs_reshoot: [],
    guarantee: null,
    fixed_download_url: null,
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
  r.guarantee = f.guarantee;
  r.visibility_after = {
    score: f.vis[1],
    grid_url: img(entry, 'grid1', () => gridImage(f.fixedScene, false, 0)),
    saliency_url: img(entry, 'sal1', () => gridImage(f.fixedScene, true, f.vis[1] / 100)),
  };
  r.images.fixed = img(entry, 'fixed', () => sceneImage(f.fixedScene, false));
  r.fixed_download_url = r.images.fixed; // data: URL; <a download> names it
  r.current_step = null;
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
    const next = entry.fixture.steps[visible];
    r.current_step = next ? { n: next.n, tool: next.tool, reason: next.reason } : null;
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
  await delay(method === 'POST' && path.startsWith('/api/analyze') ? 1400 : 250);
  let m: RegExpMatchArray | null;
  if (method === 'GET' && path === '/api/health') {
    return { ok: true, planner: 'claude', model: 'anthropic.claude (mock)' } satisfies Health as T;
  }
  if (method === 'GET' && path === '/api/meta') return structuredClone(META) as T;
  if (method === 'POST' && path === '/api/analyze') {
    const { image_base64, filename } = (body ?? {}) as { image_base64?: string; filename?: string };
    if (!image_base64) throw new ApiError(400, 'image_base64 is required');
    if (filename?.toLowerCase().includes('limit')) throw new ApiError(429, 'Daily demo limit reached');
    const entry = create(fixtureA(), filename || 'upload.jpg', new Date());
    return snapshot(entry) as T;
  }
  if (method === 'POST' && path === '/api/analyze-url') {
    const { url } = (body ?? {}) as { url?: string };
    if (!url?.startsWith('https://')) throw new ApiError(400, 'Only https:// image links are supported');
    const name = url.split('?')[0].split('/').pop() || 'image.jpg';
    return snapshot(create(fixtureA(), name, new Date())) as T;
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
        status_before: r.before.status,
        status_after: r.after?.status ?? null,
        needs_reshoot_count: r.needs_reshoot.length,
        state: r.state,
        thumb_url: r.images.fixed ?? r.images.original,
        original_thumb_url: r.images.original,
      }));
    return { items } satisfies Gallery as T;
  }
  throw new ApiError(404, `Mock has no route for ${method} ${path}`);
}
