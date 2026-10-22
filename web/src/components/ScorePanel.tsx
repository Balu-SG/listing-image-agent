import { ArrowRight, Camera, Check, RotateCcw, ScanSearch, Sparkles } from 'lucide-react';
import type { Result, Status } from '../types';
import { cx, plural } from '../lib';
import { ruleHelp, toolLabel, useMeta } from '../meta';
import { DownloadFixed } from './DownloadFixed';
import { ScoreRing } from './ScoreRing';
import { StatusChip } from './StatusChip';
import { InfoTip } from './Tooltip';
import { btn } from './Card';

export function ScorePanel({
  result,
  running,
  onFix,
  onReset,
}: {
  result: Result;
  running: boolean;
  onFix: () => void;
  onReset: () => void;
}) {
  const meta = useMeta();
  const { before, after } = result;
  const done = result.state === 'done';
  const current = after ?? before;
  const passing = current.rules.filter((r) => r.status === 'PASS').length;
  // After a run the Needs-attention panel (under the summary) lists these; before it, show reshoot rules here.
  const reshoot = done ? [] : before.rules.filter((r) => r.status === 'RESHOOT').map((r) => ({ rule_id: r.rule_id, reason: r.reason }));
  const alreadyPass = before.status === 'PASS' && !done;
  const nothingFixable = !done && !alreadyPass && !before.rules.some((r) => r.status === 'FIXABLE');
  const delta = after ? Math.round(after.score) - Math.round(before.score) : 0;

  const steps = result.steps;
  const cur = result.current_step ?? null;
  const stepNo = cur?.n ?? steps.length + 1;

  return (
    <section aria-label="Compliance score" className="rounded-xl border border-line bg-surface shadow-xs">
      <div className="flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
        <div className="flex shrink-0 items-center gap-2.5">
          {after ? (
            <>
              <ScoreRing score={before.score} status={before.status} size={52} label="Score before" dim />
              <ArrowRight aria-hidden className="size-4 text-subtle" />
              <ScoreRing score={after.score} status={after.status} size={76} label="Score after" />
            </>
          ) : (
            <ScoreRing score={before.score} status={before.status} size={76} label="Score" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[12.5px] font-medium text-subtle">
            Compliance score
            <InfoTip label="About the compliance score" title="Compliance score" content={meta?.metrics.score ?? 'Weighted share of rules that pass, from 0 to 100.'} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StatusChip status={current.status} size="md" label={statusHeadline(current.status)} />
            {after && delta !== 0 && (
              <span className={cx('num text-sm font-semibold', delta > 0 ? 'text-pass' : 'text-bad')}>
                {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </div>
          <p className="num mt-1.5 text-[13px] text-muted">
            {passing} of {current.rules.length} rules pass
          </p>
        </div>
      </div>

      <div className="border-t border-line p-4 sm:p-5">
        {running ? (
          <div role="status" aria-live="polite">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">Agent is working</p>
              <p className="num font-mono text-xs text-subtle">Step {stepNo}</p>
            </div>
            <p className="mt-1 truncate text-[13px] text-muted">
              {cur
                ? `Running step ${cur.n}: ${toolLabel(meta, cur.tool)}…`
                : steps.length
                  ? `Planning step ${stepNo}…`
                  : 'Reading the inspection report and planning…'}
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3">
              <div className="animate-indeterminate h-full w-2/5 rounded-full bg-ink" />
            </div>
          </div>
        ) : done ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <DownloadFixed result={result} className={cx(btn.base, btn.primary, 'w-full')} tipClassName="flex-1" />
            <button type="button" onClick={onReset} className={cx(btn.base, btn.secondary, 'sm:w-auto')}>
              <ScanSearch aria-hidden className="size-4" /> Inspect another
            </button>
          </div>
        ) : alreadyPass ? (
          <div>
            <p className="flex items-start gap-2 text-[13px] text-muted">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-pass" />
              Nothing to fix. This image already meets every rule, so it can be used as is.
            </p>
            <button type="button" onClick={onReset} className={cx(btn.base, btn.secondary, 'mt-3 w-full')}>
              <ScanSearch aria-hidden className="size-4" /> Inspect another
            </button>
          </div>
        ) : nothingFixable ? (
          <div>
            <p className="text-[13px] text-muted">None of the failing rules can be fixed by editing. A new photo is needed.</p>
            <button type="button" onClick={onReset} className={cx(btn.base, btn.secondary, 'mt-3 w-full')}>
              <ScanSearch aria-hidden className="size-4" /> Inspect another
            </button>
          </div>
        ) : (
          <div>
            <button type="button" onClick={onFix} className={cx(btn.base, btn.primary, 'w-full py-3')}>
              {result.state === 'error' ? <RotateCcw aria-hidden className="size-4" /> : <Sparkles aria-hidden className="size-4" />}
              {result.state === 'error' ? 'Retry fix' : 'Fix with agent'}
            </button>
            <p className="mt-2.5 text-center text-xs text-subtle">
              The agent plans, OpenCV edits, and every edit is verified against the product.
            </p>
          </div>
        )}
        {result.state === 'error' && result.error && (
          <p role="alert" className="mt-3 rounded-lg border border-bad-line bg-bad-soft px-3 py-2 text-[13px] text-bad">
            {result.error}
          </p>
        )}
      </div>

      {reshoot.length > 0 && (
        <div className="border-t border-line p-4 sm:p-5">
          <div className="rounded-lg border border-bad-line bg-bad-soft p-3.5">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-bad">
              <Camera aria-hidden className="size-4" /> Needs a new photo
            </h3>
            <ul className="mt-2 space-y-1.5">
              {reshoot.map((r) => (
                <li key={r.rule_id} className="flex gap-2 text-[13px] leading-snug">
                  <span className="mt-px font-mono text-[11.5px] text-bad">{r.rule_id}</span>
                  <span>
                    <span className="font-medium">{ruleHelp(meta, r.rule_id)?.title ?? before.rules.find((x) => x.rule_id === r.rule_id)?.name}</span>
                    <span className="text-muted"> · {r.reason}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              {plural(reshoot.length, 'rule')} cannot be fixed without changing the product, so the agent leaves {reshoot.length === 1 ? 'it' : 'them'} alone.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function statusHeadline(s: Status): string {
  return s === 'PASS' ? 'Compliant' : s === 'FIXABLE' ? 'Fixable' : 'Needs reshoot';
}
