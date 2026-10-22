import type { GalleryItem, Status } from './types';

export const STATUS_LABEL: Record<Status, string> = {
  PASS: 'Pass',
  FIXABLE: 'Fixable',
  RESHOOT: 'Reshoot',
};

export const STATUS_TEXT: Record<Status, string> = {
  PASS: 'text-pass',
  FIXABLE: 'text-fix',
  RESHOOT: 'text-bad',
};

export const STATUS_CHIP: Record<Status, string> = {
  PASS: 'bg-pass-soft text-pass border-pass-line',
  FIXABLE: 'bg-fix-soft text-fix border-fix-line',
  RESHOOT: 'bg-bad-soft text-bad border-bad-line',
};

export const STATUS_RANK: Record<Status, number> = { PASS: 0, FIXABLE: 1, RESHOOT: 2 };

/** Final status of a gallery item: status_after when finished, else status_before. */
export function galleryStatus(item: GalleryItem): Status | null {
  if (item.state === 'done') return item.status_after ?? item.status_before ?? null;
  return item.status_before ?? null;
}

export const GALLERY_STATUS_LABEL: Record<Status, string> = {
  PASS: 'Compliant',
  FIXABLE: 'Not fixed',
  RESHOOT: 'Needs reshoot',
};

/** needs_reshoot entries for FIXABLE rules the agent could not fix start with this prefix. */
export const NOT_FIXED_PREFIX = 'Not fixed automatically';

/** "Not fixed automatically (why). Rest." -> { why, rest } */
export function splitNotFixed(reason: string): { why: string | null; rest: string } {
  const m = reason.match(/^Not fixed automatically\s*\(([^)]*)\)\.?\s*(.*)$/s);
  if (!m) return { why: null, rest: reason };
  return { why: m[1], rest: m[2] };
}

/** Fallback labels, used only if /api/meta is unavailable. */
const TOOL_LABEL: Record<string, string> = {
  whiten_background: 'Whiten background',
  recrop_to_fill: 'Reframe to fill',
  pad_to_square: 'Pad to square',
  remove_border: 'Remove border',
  inpaint_watermark: 'Remove text or badge',
  finish: 'Finish',
};

export function fallbackToolLabel(tool: string): string {
  return TOOL_LABEL[tool] ?? tool.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** "IMG_1234.jpg" -> "IMG_1234-fixed.png" */
export function fixedFilename(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '') || 'image';
  return `${base}-fixed.png`;
}
