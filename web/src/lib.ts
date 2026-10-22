import type { Status } from './types';

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
  PASS: 'bg-pass-soft text-pass',
  FIXABLE: 'bg-fix-soft text-fix',
  RESHOOT: 'bg-bad-soft text-bad',
};

/** Status implied by a bare score (used where only a number is available, e.g. gallery). */
export function scoreTone(score: number): Status {
  if (score >= 85) return 'PASS';
  if (score >= 50) return 'FIXABLE';
  return 'RESHOOT';
}

const TOOL_LABEL: Record<string, string> = {
  whiten_background: 'Whiten background',
  recrop_to_fill: 'Recrop to fill',
  pad_to_square: 'Pad to square',
  remove_border: 'Remove border',
  inpaint_watermark: 'Remove text / badge',
  upscale: 'Upscale',
  finish: 'Finish',
};

export function prettyTool(tool: string): string {
  return TOOL_LABEL[tool] ?? tool.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
