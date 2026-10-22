import { ArrowRight } from 'lucide-react';
import type { Report } from '../types';
import { StatusChip } from './StatusChip';

export function RulesList({ before, after }: { before: Report; after: Report | null }) {
  const afterById = new Map(after?.rules.map((r) => [r.rule_id, r]) ?? []);
  return (
    <ol className="divide-y divide-line">
      {before.rules.map((rule) => {
        const fixed = afterById.get(rule.rule_id);
        const shown = fixed ?? rule;
        return (
          <li key={rule.rule_id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className="mt-0.5 w-7 shrink-0 font-mono text-xs font-semibold text-muted">{rule.rule_id}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <h3 className="text-sm font-medium">{rule.name}</h3>
                <div className="flex items-center gap-1.5">
                  {fixed && fixed.status !== rule.status && (
                    <>
                      <span className="opacity-60">
                        <StatusChip status={rule.status} />
                      </span>
                      <ArrowRight aria-label="now" className="size-3.5 text-muted" />
                    </>
                  )}
                  <StatusChip status={shown.status} />
                </div>
              </div>
              <p className="mt-1 text-sm text-muted">{shown.reason}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
