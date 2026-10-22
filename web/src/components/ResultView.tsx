import { useEffect, useState } from 'react';
import { Wand2, Loader2, CheckCircle2, ListChecks, Bot, Camera, MessageSquareQuote, RotateCcw } from 'lucide-react';
import type { Result } from '../types';
import { assetUrl } from '../api';
import { Card, ScoreDelta } from './Card';
import { ScoreRing } from './ScoreRing';
import { StatusChip } from './StatusChip';
import { RulesList } from './RulesList';
import { AgentTimeline } from './AgentTimeline';
import { CompareSlider } from './CompareSlider';
import { ProofCard } from './ProofCard';
import { VisibilityCard } from './VisibilityCard';
import { cx } from '../lib';

type ImageView = 'compare' | 'original' | 'overlay' | 'fixed_overlay';

export function ResultView({ result, fixing, onFix }: { result: Result; fixing: boolean; onFix: () => void }) {
  const done = result.state === 'done';
  const running = result.state === 'running' || fixing;
  const hasFixed = done && !!result.images.fixed;
  const [view, setView] = useState<ImageView>(hasFixed ? 'compare' : 'original');

  // Switch to the comparison automatically when the fix lands, and reset when another result loads.
  useEffect(() => {
    setView(hasFixed ? 'compare' : 'original');
  }, [result.id, hasFixed]);

  const views: { key: ImageView; label: string }[] = [
    ...(hasFixed ? [{ key: 'compare' as const, label: 'Before / after' }] : []),
    { key: 'original', label: 'Original' },
    { key: 'overlay', label: 'Violations' },
    ...(hasFixed && result.images.fixed_overlay ? [{ key: 'fixed_overlay' as const, label: 'Fixed checks' }] : []),
  ];

  const imgSrc =
    view === 'overlay'
      ? assetUrl(result.images.overlay)
      : view === 'fixed_overlay'
        ? assetUrl(result.images.fixed_overlay)
        : assetUrl(result.images.original);

  const before = result.before;
  const after = result.after;
  const fixLabel = running ? 'Agent working…' : done ? 'Fixed' : before.status === 'PASS' ? 'Already compliant' : result.state === 'error' ? 'Retry fix' : 'Fix with agent';
  const fixDisabled = before.status === 'PASS' || running || done;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Image panel */}
        <Card className="self-start">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="truncate text-base font-semibold" title={result.filename}>
              {result.filename}
            </h2>
            <div role="tablist" aria-label="Image view" className="inline-flex flex-wrap rounded-lg bg-surface-2 p-1 text-sm">
              {views.map((v) => (
                <button
                  key={v.key}
                  role="tab"
                  aria-selected={view === v.key}
                  onClick={() => setView(v.key)}
                  className={cx('rounded-md px-3 py-1 font-medium whitespace-nowrap transition-colors', view === v.key ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg')}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          {view === 'compare' && hasFixed ? (
            <>
              <CompareSlider before={assetUrl(result.images.original)!} after={assetUrl(result.images.fixed)!} />
              <p className="mt-2 text-center text-xs text-muted">Drag the divider, or focus it and use the arrow keys.</p>
            </>
          ) : (
            <div className="checker aspect-square w-full overflow-hidden rounded-xl border border-line">
              <img
                src={imgSrc}
                alt={view === 'original' ? 'Uploaded product image' : 'Product image with rule violations highlighted'}
                className="size-full object-contain"
              />
            </div>
          )}
          <p className="mt-3 text-xs text-muted tabular-nums">
            {before.width} × {before.height} px
            {after && (after.width !== before.width || after.height !== before.height) && ` → ${after.width} × ${after.height} px`}
          </p>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
        {/* Score + action */}
        <Card>
          <div className="flex flex-wrap items-center gap-5">
            {after ? (
              <div className="flex items-center gap-3">
                <ScoreRing score={before.score} status={before.status} size={84} label="Before" />
                <span aria-hidden className="text-2xl text-muted">→</span>
                <ScoreRing score={after.score} status={after.status} size={116} label="After" />
              </div>
            ) : (
              <ScoreRing score={before.score} status={before.status} size={128} label="Score" />
            )}
            <div className="flex min-w-40 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusChip status={(after ?? before).status} size="md" />
                {after && (
                  <span className="text-sm">
                    <ScoreDelta before={before.score} after={after.score} />
                  </span>
                )}
              </div>
              <p className="text-sm text-muted">
                {(after ?? before).rules.filter((r) => r.status === 'PASS').length} of {(after ?? before).rules.length} rules pass
                {result.planner && <> · planned by {result.planner === 'claude' ? 'Claude' : 'rules'}</>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onFix}
            disabled={fixDisabled}
            className={cx(
              'mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition',
              done
                ? 'bg-pass-soft text-pass'
                : 'bg-accent text-accent-fg shadow-sm hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {running ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : done ? (
              <CheckCircle2 aria-hidden className="size-4" />
            ) : result.state === 'error' ? (
              <RotateCcw aria-hidden className="size-4" />
            ) : (
              <Wand2 aria-hidden className="size-4" />
            )}
            {fixLabel}
          </button>
          {before.status === 'PASS' && !done && (
            <p className="mt-2 text-center text-xs text-muted">This image already meets every rule.</p>
          )}
          {result.state === 'error' && result.error && (
            <p role="alert" className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
              {result.error}
            </p>
          )}
        </Card>

        {/* Summary + reshoot (only when done) */}
        {done && (result.summary || result.needs_reshoot.length > 0) && (
          <Card title="Agent summary" icon={<MessageSquareQuote aria-hidden className="size-5" />} className="animate-step-in">
            {result.summary && <p className="text-sm leading-relaxed">{result.summary}</p>}
            {result.needs_reshoot.length > 0 && (
              <div className="mt-4 rounded-xl border border-bad/30 bg-bad-soft p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-bad">
                  <Camera aria-hidden className="size-4" /> Needs reshoot
                </h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {result.needs_reshoot.map((r) => (
                    <li key={r.rule_id} className="flex gap-2">
                      <span className="font-mono text-xs font-semibold text-bad">{r.rule_id}</span>
                      <span>{r.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Amazon main-image rules" icon={<ListChecks aria-hidden className="size-5" />}>
          <RulesList before={before} after={after} />
        </Card>
        <Card
          title="Agent timeline"
          icon={<Bot aria-hidden className="size-5" />}
          action={result.steps.length > 0 ? <span className="text-xs text-muted">{result.steps.length} steps</span> : undefined}
        >
          <AgentTimeline steps={result.steps} state={fixing && result.state === 'analyzed' ? 'running' : result.state} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {done && result.guarantee ? <ProofCard result={result} /> : null}
        <VisibilityCard key={result.id + String(!!result.visibility_after)} before={result.visibility_before} after={result.visibility_after} />
      </div>
    </div>
  );
}
