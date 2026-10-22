import { useState } from 'react';
import { ArrowRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import type { Report, RuleResult } from '../types';
import { cx, splitNotFixed, STATUS_RANK } from '../lib';
import { useMeta } from '../meta';
import { StatusChip } from './StatusChip';
import { InfoTip, Tooltip } from './Tooltip';
import { Panel } from './Card';
import { RuleTipBody, SOURCE_FALLBACK } from './help';

export function RulesList({
  before,
  after,
  notFixed = [],
}: {
  before: Report;
  after: Report | null;
  /** needs_reshoot entries after a run: explains rules that are still FIXABLE. */
  notFixed?: { rule_id: string; reason: string }[];
}) {
  const notFixedById = new Map(notFixed.map((n) => [n.rule_id, n.reason]));
  const meta = useMeta();
  const [showUnchecked, setShowUnchecked] = useState(false);
  const [showPassing, setShowPassing] = useState(() => before.rules.every((r) => r.status === 'PASS'));
  const afterById = new Map(after?.rules.map((r) => [r.rule_id, r]) ?? []);

  const rows = before.rules.map((rule) => ({ before: rule, after: afterById.get(rule.rule_id) ?? null }));
  const attention = rows
    .filter((r) => r.before.status !== 'PASS' || (r.after && r.after.status !== 'PASS') || (r.after ?? r.before).evidence?.zoom === false)
    .sort((a, b) => STATUS_RANK[(b.after ?? b.before).status] - STATUS_RANK[(a.after ?? a.before).status]);
  const passing = rows.filter((r) => !attention.includes(r));

  const current = after ?? before;
  const fail = current.rules.filter((r) => r.status !== 'PASS').length;
  const fixedCount = after ? rows.filter((r) => r.before.status !== 'PASS' && r.after?.status === 'PASS').length : 0;

  return (
    <Panel
      title="Amazon main-image rules"
      flush
      action={
        <span className="num text-xs text-subtle">
          {after && fixedCount > 0 ? `${fixedCount} fixed · ` : ''}
          {fail === 0 ? `All ${current.rules.length} pass` : `${fail} failing`}
        </span>
      }
    >
      {attention.length > 0 && (
        <ol className="divide-y divide-line">
          {attention.map((r) => (
            <RuleRow key={r.before.rule_id} before={r.before} after={r.after} meta={meta} notFixed={notFixedById.get(r.before.rule_id)} />
          ))}
        </ol>
      )}
      {passing.length > 0 && (
        <div className={cx(attention.length > 0 && 'border-t border-line')}>
          <button
            type="button"
            aria-expanded={showPassing}
            onClick={() => setShowPassing((s) => !s)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-[13px] font-medium text-muted hover:bg-surface-2/60 hover:text-fg focus-visible:rounded-none sm:px-5"
          >
            <span className="flex items-center gap-2">
              <StatusChip status="PASS" tip={false} label={`${passing.length}`} />
              {passing.length === 1 ? '1 rule passes' : `${passing.length} rules pass`}
            </span>
            <ChevronDown aria-hidden className={cx('size-4 transition-transform', showPassing && 'rotate-180')} />
          </button>
          {showPassing && (
            <ol className="divide-y divide-line border-t border-line">
              {passing.map((r) => (
                <RuleRow key={r.before.rule_id} before={r.before} after={r.after} meta={meta} compact />
              ))}
            </ol>
          )}
        </div>
      )}
      <RulesFooter meta={meta} open={showUnchecked} onToggle={() => setShowUnchecked((s) => !s)} />
    </Panel>
  );
}

function RulesFooter({ meta, open, onToggle }: { meta: ReturnType<typeof useMeta>; open: boolean; onToggle: () => void }) {
  const source = meta?.source ?? SOURCE_FALLBACK;
  const unchecked = meta?.not_checked ?? [];
  return (
    <div className="border-t border-line bg-surface-2/50 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5">
        <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-subtle hover:text-fg hover:underline">
          Source: Amazon Seller Central, product image requirements
          <ArrowUpRight aria-hidden className="size-3" />
        </a>
        {unchecked.length > 0 && (
          <button type="button" aria-expanded={open} onClick={onToggle} className="inline-flex items-center gap-1 font-medium text-muted hover:text-fg">
            Not checked automatically ({unchecked.length})
            <ChevronDown aria-hidden className={cx('size-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>
      {open && unchecked.length > 0 && (
        <div className="px-4 pb-3 sm:px-5">
          <p className="text-subtle">Amazon also requires these. They need a human eye, so check them yourself:</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-muted marker:text-line-strong">
            {unchecked.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RuleRow({
  before,
  after,
  meta,
  compact = false,
  notFixed,
}: {
  before: RuleResult;
  after: RuleResult | null;
  meta: ReturnType<typeof useMeta>;
  compact?: boolean;
  notFixed?: string;
}) {
  const stillFixable = after?.status === 'FIXABLE';
  const nf = notFixed ? splitNotFixed(notFixed) : null;
  const shown = after ?? before;
  const changed = after && after.status !== before.status;
  const title = meta?.rules[before.rule_id]?.title ?? before.name;
  const scene = before.rule_id === 'R1' && before.evidence?.mode === 'scene';
  const zoomOff = before.rule_id === 'R3' && shown.evidence?.zoom === false;
  return (
    <li className={cx('flex gap-3 px-4 sm:px-5', compact ? 'py-2.5' : 'py-3.5')}>
      <span className="mt-px w-6 shrink-0 font-mono text-[11.5px] leading-5 text-subtle">{before.rule_id}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <h3 className="flex min-w-0 items-center gap-0.5 text-[13.5px] leading-5 font-medium">
            <span className="min-w-0">{title}</span>
            <InfoTip label={`About rule ${before.rule_id}: ${title}`} title={`${before.rule_id} · ${title}`} content={<RuleTipBody meta={meta} id={before.rule_id} />} wide />
            {scene && (
              <Tooltip title="Scene photo" content={meta?.metrics.segmentation.scene ?? 'Lifestyle photo: nothing is edited.'}>
                <span tabIndex={0} className="ml-1 rounded border border-line px-1 font-mono text-[10.5px] text-muted">
                  scene
                </span>
              </Tooltip>
            )}
            {zoomOff && (
              <Tooltip title="Zoom off" content="Under 1,000 px on the longest side the image is accepted, but Amazon's zoom needs 1,000+ px. Amazon says not to enlarge small images, so use a larger original.">
                <span tabIndex={0} className="ml-1 rounded border border-fix-line bg-fix-soft px-1 font-mono text-[10.5px] whitespace-nowrap text-fix">
                  zoom off
                </span>
              </Tooltip>
            )}
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            {changed && (
              <>
                <StatusChip status={before.status} muted />
                <ArrowRight aria-label="now" className="size-3 text-subtle" />
              </>
            )}
            {stillFixable ? (
              <StatusChip
                status="FIXABLE"
                label="Not fixed"
                tipTitle="Not fixed automatically"
                tipContent={nf?.why ? `The agent could not fix this safely: ${nf.why}. A person should handle it.` : 'The agent could not fix this safely on this image. A person should handle it.'}
              />
            ) : (
              <StatusChip status={shown.status} />
            )}
          </div>
        </div>
        <p className={cx('mt-0.5 text-[13px] leading-snug text-muted', compact && 'text-subtle')}>{shown.reason}</p>
      </div>
    </li>
  );
}
