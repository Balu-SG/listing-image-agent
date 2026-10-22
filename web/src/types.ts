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

export interface Guarantee {
  passed: boolean;
  changed_product_pixels: number;
  /** How many product pixels were compared. */
  product_pixels: number;
  /** Set only after a 2x upscale: the check is then a round trip (shrink back + compare). */
  psnr_db: number | null;
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
  /** The tool running right now (state == "running"), else null. */
  current_step?: { n: number; tool: string; reason: string } | null;
  summary: string | null;
  needs_reshoot: { rule_id: string; reason: string }[];
  guarantee: Guarantee | null;
  images: {
    original: string;
    overlay: string;
    fixed: string | null;
    fixed_overlay: string | null;
    diff: string | null;
  };
  /** Same image as images.fixed, served as an attachment named <name>-fixed.png. */
  fixed_download_url?: string | null;
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
  status_before?: Status;
  status_after?: Status | null;
  needs_reshoot_count?: number;
  state: ResultState;
  thumb_url: string;
  original_thumb_url?: string;
}

export interface Gallery {
  items: GalleryItem[];
}

export interface RuleHelp {
  title: string;
  /** Where the rule comes from: Amazon's own wording, derived from it, or our own check. */
  basis?: 'amazon' | 'derived' | 'ours';
  /** Amazon's exact wording, or null when Amazon's page does not state it. */
  amazon?: string | null;
  what: string;
  why: string;
  how: string;
  fix: string | null;
}

export interface ToolHelp {
  label: string;
  what: string;
  safety: string;
}

export interface Meta {
  marketplace: string;
  source?: { title: string; url: string; read_on: string };
  /** Amazon rules we do not check automatically. */
  not_checked?: string[];
  /** Colours used in images.overlay, from the same constants as the drawing. */
  overlay_legend?: { colour: string; label: string }[];
  rules: Record<string, RuleHelp>;
  weights: Record<string, number>;
  tools: Record<string, ToolHelp>;
  metrics: {
    score: string;
    status: Record<Status, string>;
    visibility: string;
    guarantee: string;
    diff_map: string;
    planner: { claude: string; rules: string };
    segmentation: { studio: string; scene: string };
  };
}
