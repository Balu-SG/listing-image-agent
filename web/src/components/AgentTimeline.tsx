import { Check, Minus, X, Camera, Loader2 } from 'lucide-react';
import type { Result, Step } from '../types';
import { cx, plural } from '../lib';
import { toolLabel, useMeta } from '../meta';
import { Panel } from './Card';
import { InfoTip, Tooltip } from './Tooltip';
import { ToolTipBody } from './help';

const OUTCOME = {
  applied: { icon: Check, dot: 'bg-pass-soft text-pass border-pass-line', chip: 'text-pass', label: 'Applied' },
  rejected: { icon: Minus, dot: 'bg-fix-soft text-fix border-fix-line', chip: 'text-fix', label: 'Rejected' },
  error: { icon: X, dot: 'bg-bad-soft text-bad border-bad-line', chip: 'text-bad', label: 'Error' },
} as const;

const OUTCOME_TIP = {
  applied: 'The edit passed the product check and was kept.',
  rejected: 'The edit was undone: it would have lowered the score or changed the product.',
  error: 'The tool could not run on this image; nothing was changed.',
} as const;

export function AgentTimeline({ result, running }: { result: Result; running: boolean }) {
  const meta = useMeta();
  const steps = result.steps;
  const applied = steps.filter((s) => s.outcome === 'applied' && s.tool !== 'finish').length;

  return (
    <Panel
      title="Agent timeline"
      help={
        <InfoTip
          label="About the planner"
          title={result.planner === 'claude' ? 'Planned by Claude on Bedrock' : result.planner === 'rules' ? 'Planned by the rule planner' : 'Planner'}
          content={result.planner ? meta?.metrics.planner[result.planner] : 'The planner reads the inspection report and chooses which tools to run.'}
        />
      }
      flush
      action={
        <span className="num text-xs text-subtle">
          {plural(steps.length, 'step')}
          {steps.length > 0 && ` · ${applied} applied`}
        </span>
      }
    >
      {steps.length === 0 && !running ? (
        <p className="px-4 py-4 text-[13px] text-muted sm:px-5">No edits were made. Nothing here could be improved without changing the product.</p>
      ) : (
        <ol className="relative px-4 py-4 sm:px-5">
          {steps.map((s, i) => (
            <StepRow key={s.n} step={s} last={i === steps.length - 1 && !running} />
          ))}
          {running && (result.current_step ? <PendingStep step={result.current_step} /> : (
            <li className="relative flex gap-3" aria-live="polite">
              <span className="relative z-10 grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface">
                <span className="size-1.5 animate-pulse rounded-full bg-ink" />
              </span>
              <div className="flex-1 pt-0.5">
                <p className="text-[13px] text-muted">{steps.length ? `Planning step ${steps.length + 1}…` : 'Planning the first step…'}</p>
                <div className="skeleton mt-2 h-2.5 w-2/3" />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function PendingStep({ step }: { step: { n: number; tool: string; reason: string } }) {
  const meta = useMeta();
  return (
    <li className="animate-step-in relative flex gap-3" aria-live="polite">
      <span className="relative z-10 grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface">
        <Loader2 aria-hidden className="size-3.5 animate-spin text-muted" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="num font-mono text-[11.5px] text-subtle">{step.n}.</span>
            <Tooltip title={toolLabel(meta, step.tool)} content={<ToolTipBody meta={meta} tool={step.tool} />} wide>
              <button type="button" className="text-left text-[13.5px] font-medium decoration-line-strong decoration-dotted underline-offset-[3px] hover:underline">
                {toolLabel(meta, step.tool)}
              </button>
            </Tooltip>
            <code className="font-mono text-[11px] text-subtle">{step.tool}</code>
          </div>
          <span className="shrink-0 pt-0.5 text-xs font-medium text-muted">Running…</span>
        </div>
        {step.reason && <p className="mt-0.5 text-[13px] leading-snug text-muted">{step.reason}</p>}
        <p className="mt-1 font-mono text-[11.5px] text-subtle">checking product pixels after the edit…</p>
      </div>
    </li>
  );
}

function StepRow({ step, last }: { step: Step; last: boolean }) {
  const meta = useMeta();
  const o = OUTCOME[step.outcome];
  const Icon = o.icon;
  return (
    <li className="animate-step-in relative flex gap-3 pb-4 last:pb-0">
      {!last && <span aria-hidden className="absolute top-6 bottom-0 left-3 w-px -translate-x-1/2 bg-line" />}
      <span className={cx('relative z-10 grid size-6 shrink-0 place-items-center rounded-full border', o.dot)}>
        <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="num font-mono text-[11.5px] text-subtle">{step.n}.</span>
            <Tooltip title={toolLabel(meta, step.tool)} content={<ToolTipBody meta={meta} tool={step.tool} />} wide>
              <button type="button" className="text-left text-[13.5px] font-medium decoration-line-strong decoration-dotted underline-offset-[3px] hover:underline">
                {toolLabel(meta, step.tool)}
              </button>
            </Tooltip>
            <code className="font-mono text-[11px] text-subtle">{step.tool}</code>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5 text-xs">
            <Tooltip content={OUTCOME_TIP[step.outcome]}>
              <span tabIndex={0} className={cx('font-medium', o.chip)}>
                {o.label}
              </span>
            </Tooltip>
            {step.score_after !== null && (
              <span className="num rounded border border-line px-1.5 font-mono text-[11px] text-muted" title="Score after this step">
                {Math.round(step.score_after)}
              </span>
            )}
          </div>
        </div>
        {step.reason && <p className="mt-0.5 text-[13px] leading-snug text-muted">{step.reason}</p>}
        {step.detail && <p className={cx('mt-1 font-mono text-[11.5px] leading-snug', step.outcome === 'applied' ? 'text-subtle' : o.chip)}>{step.detail}</p>}
      </div>
    </li>
  );
}

/** Before a fix starts: what the agent would do, from failing rules' fix tools. */
export function AgentCapabilities({ result }: { result: Result }) {
  const meta = useMeta();
  const plan = new Map<string, string[]>();
  for (const r of result.before.rules) {
    if (r.status !== 'FIXABLE') continue;
    for (const t of r.fix_tools) plan.set(t, [...(plan.get(t) ?? []), r.rule_id]);
  }
  const reshoot = result.before.rules.filter((r) => r.status === 'RESHOOT');
  if (plan.size === 0 && reshoot.length === 0) return null;

  return (
    <Panel
      title="What the agent can do"
      help={<InfoTip label="About the agent" title="Plan, then verify" content="The planner chooses from these tools. Each one edits only the backdrop or framing, and every edit is checked against the product before it is kept." />}
      flush
    >
      <ul className="divide-y divide-line">
        {[...plan.entries()].map(([tool, rules]) => (
          <li key={tool} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
            <div className="flex min-w-0 items-baseline gap-2">
              <Tooltip title={toolLabel(meta, tool)} content={<ToolTipBody meta={meta} tool={tool} />} wide>
                <button type="button" className="truncate text-left text-[13.5px] font-medium decoration-line-strong decoration-dotted underline-offset-[3px] hover:underline">
                  {toolLabel(meta, tool)}
                </button>
              </Tooltip>
              <code className="hidden font-mono text-[11px] text-subtle sm:inline">{tool}</code>
            </div>
            <span className="shrink-0 font-mono text-[11.5px] text-subtle">fixes {rules.join(', ')}</span>
          </li>
        ))}
        {reshoot.map((r) => (
          <li key={r.rule_id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
            <span className="flex items-center gap-2 text-[13.5px] text-muted">
              <Camera aria-hidden className="size-3.5 text-bad" /> {meta?.rules[r.rule_id]?.title ?? r.name}
            </span>
            <span className="shrink-0 font-mono text-[11.5px] text-bad">{r.rule_id} needs a new photo</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
