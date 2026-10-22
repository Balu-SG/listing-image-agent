// Mirrors docs/API.md exactly.
export type Status = 'PASS' | 'FIXABLE' | 'RESHOOT';

export interface RuleResult {
  rule_id: string;
  name: string;
  status: Status;
  value: number;
  reason: string;
  fix_tools: string[];
  evidence: Record<string, unknown>;
}

export interface Report {
  score: number;
  status: Status;
  width: number;
  height: number;
  rules: RuleResult[];
}

export interface Visibility {
  score: number;
  grid_url: string;
  saliency_url: string;
}

export type ToolName =
  | 'whiten_background'
  | 'recrop_to_fill'
  | 'pad_to_square'
  | 'remove_border'
  | 'inpaint_watermark'
  | 'upscale'
  | 'finish';

export interface Step {
  n: number;
  tool: string;
  input: Record<string, unknown>;
  reason: string;
  outcome: 'applied' | 'rejected' | 'error';
  detail: string;
  score_after: number | null;
}

export type ResultState = 'analyzed' | 'running' | 'done' | 'error';

export interface Result {
  id: string;
  filename: string;
  created_at: string;
  state: ResultState;
  planner: 'claude' | 'rules' | null;
  before: Report;
  after: Report | null;
  visibility_before: Visibility;
  visibility_after: Visibility | null;
  steps: Step[];
  summary: string | null;
  needs_reshoot: { rule_id: string; reason: string }[];
  guarantee: { passed: boolean; changed_product_pixels: number } | null;
  images: {
    original: string;
    overlay: string;
    fixed: string | null;
    fixed_overlay: string | null;
    diff: string | null;
  };
  error: string | null;
}

export interface Health {
  ok: true;
  planner: 'claude' | 'rules';
  model: string | null;
}

export interface GalleryItem {
  id: string;
  filename: string;
  score_before: number;
  score_after: number | null;
  state: ResultState;
  thumb_url: string;
}

export interface Gallery {
  items: GalleryItem[];
}
