import type { Meta } from '../types';
import { toolLabel } from '../meta';
import { TipRow } from './Tooltip';

export const SOURCE_FALLBACK = {
  title: 'Amazon Seller Central: Product image requirements',
  url: 'https://sellercentral.amazon.com/help/hub/reference/external/G1881',
};

/**
 * Rich tooltip body for a rule. Amazon's own wording is shown as a quote, kept visibly
 * separate from how we measure it, so it is clear which part is Amazon's rule.
 */
export function RuleTipBody({ meta, id }: { meta: Meta | null; id: string }) {
  const r = meta?.rules[id];
  if (!r) return <>Rule {id}.</>;
  const weight = meta?.weights[id];
  return (
    <>
      {r.amazon ? (
        <TipRow label={r.basis === 'derived' ? 'Related Amazon rule' : 'Amazon says'}>
          <span className="italic">“{r.amazon}”</span>
        </TipRow>
      ) : (
        <TipRow label="Rule">{r.what}</TipRow>
      )}
      {r.basis === 'derived' && <TipRow label="Derived rule">{r.why}</TipRow>}
      {r.basis === 'ours' && <TipRow label="Our check, not an Amazon rule">{r.why}</TipRow>}
      <TipRow label="How we check">{r.how}</TipRow>
      <TipRow label="Fix">
        {r.fix ? toolLabel(meta, r.fix) : 'Needs a new photo'}
        {weight !== undefined && <span className="text-tip-muted"> · score weight {weight}</span>}
      </TipRow>
      <div className="mt-2 border-t border-tip-muted/25 pt-1.5 text-[11px] text-tip-muted">
        Source: Amazon Seller Central, product image requirements{meta?.source?.read_on ? ` (read ${meta.source.read_on})` : ''}
      </div>
    </>
  );
}

export function ToolTipBody({ meta, tool }: { meta: Meta | null; tool: string }) {
  const t = meta?.tools[tool];
  if (!t) return <span className="font-mono">{tool}</span>;
  return (
    <>
      <TipRow label="What it does">{t.what}</TipRow>
      {t.safety && <TipRow label="Safety">{t.safety}</TipRow>}
      <div className="mt-1.5 font-mono text-[11px] text-tip-muted">{tool}</div>
    </>
  );
}
