import { Check, X, AlertTriangle, Flag, Loader2, Bot } from 'lucide-react';
import type { Step, ResultState } from '../types';
import { cx, prettyTool, scoreTone, STATUS_TEXT } from '../lib';

const OUTCOME = {
  applied: { icon: Check, dot: 'bg-pass text-white', chip: 'bg-pass-soft text-pass', label: 'Applied' },
  rejected: { icon: X, dot: 'bg-fix text-white', chip: 'bg-fix-soft text-fix', label: 'Rejected' },
  error: { icon: AlertTriangle, dot: 'bg-bad text-white', chip: 'bg-bad-soft text-bad', label: 'Error' },
} as const;

export function AgentTimeline({ steps, state }: { steps: Step[]; state: ResultState }) {
  const running = state === 'running';
  if (!steps.length && !running) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
        <Bot aria-hidden className="size-6" />
        <p>The agent plans each edit, and OpenCV tools apply it. Its steps appear here.</p>
      </div>
    );
  }
  return (
    <ol className="relative" aria-live="polite" aria-busy={running}>
      {steps.map((step, i) => {
        const o = OUTCOME[step.outcome] ?? OUTCOME.error;
        const isFinish = step.tool === 'finish';
        const Icon = isFinish && step.outcome === 'applied' ? Flag : o.icon;
        const last = i === steps.length - 1 && !running;
        return (
          <li key={step.n} className="animate-step-in relative flex gap-3 pb-5 last:pb-0">
            {!last && <span aria-hidden className="absolute top-8 bottom-0 left-[15px] w-px bg-line" />}
            <span className={cx('relative z-10 grid size-8 shrink-0 place-items-center rounded-full', isFinish ? 'bg-accent text-accent-fg' : o.dot)}>
              <Icon aria-hidden className="size-4" />
            </span>
            <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xs font-semibold text-muted tabular-nums">{step.n}</span>
                  <h3 className="truncate text-sm font-semibold">{prettyTool(step.tool)}</h3>
                  <code className="hidden truncate font-mono text-[11px] text-muted sm:inline">{step.tool}</code>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', o.chip)}>
                    <span className="sr-only">Outcome: </span>
                    {o.label}
                  </span>
                  {step.score_after !== null && (
                    <span
                      className={cx('rounded-full bg-surface px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ring-line', STATUS_TEXT[scoreTone(step.score_after)])}
                      title="Score after this step"
                    >
                      <span className="sr-only">Score after: </span>
                      {Math.round(step.score_after)}
                    </span>
                  )}
                </div>
              </div>
              {step.reason && (
                <p className="mt-1.5 text-sm">
                  <span className="font-medium text-accent">Planner: </span>
                  {step.reason}
                </p>
              )}
              {step.detail && <p className="mt-1 font-mono text-xs break-words text-muted">{step.detail}</p>}
            </div>
          </li>
        );
      })}
      {running && (
        <li className="animate-step-in relative flex items-center gap-3" role="status">
          <span className="animate-pulse-ring grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <Loader2 aria-hidden className="size-4 animate-spin" />
          </span>
          <span className="text-sm text-muted">{steps.length ? 'Planning the next edit…' : 'Agent is reading the report…'}</span>
        </li>
      )}
    </ol>
  );
}
