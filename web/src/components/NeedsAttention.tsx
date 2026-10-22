import { Camera, UserRound } from 'lucide-react';
import type { Result } from '../types';
import { cx, NOT_FIXED_PREFIX, splitNotFixed } from '../lib';
import { useMeta } from '../meta';
import { Panel } from './Card';
import { InfoTip } from './Tooltip';
import { RuleTipBody } from './help';

/**
 * After a run: what is left for the seller. Split into rules that need a new photo (still
 * RESHOOT) and fixable rules the agent could not fix safely (need a person).
 */
export function NeedsAttention({ result }: { result: Result }) {
  const meta = useMeta();
  const items = result.needs_reshoot;
  if (!items.length) return null;
  const afterStatus = new Map(result.after?.rules.map((r) => [r.rule_id, r.status]) ?? []);
  const isPerson = (i: { rule_id: string; reason: string }) =>
    i.reason.startsWith(NOT_FIXED_PREFIX) || afterStatus.get(i.rule_id) === 'FIXABLE';
  const person = items.filter(isPerson);
  const photo = items.filter((i) => !isPerson(i));
  const title = (id: string) => meta?.rules[id]?.title ?? result.before.rules.find((r) => r.rule_id === id)?.name ?? id;

  const groups = [
    {
      key: 'photo',
      label: 'Needs a new photo',
      tip: 'Editing cannot fix these without changing the product, so the agent leaves them alone.',
      icon: Camera,
      tone: 'text-bad',
      items: photo,
    },
    {
      key: 'person',
      label: 'Needs a person',
      tip: 'These could be fixed in principle, but the agent could not do it safely on this image. A person should edit or check them.',
      icon: UserRound,
      tone: 'text-fix',
      items: person,
    },
  ].filter((g) => g.items.length);

  return (
    <Panel title="Needs attention" action={<span className="num text-xs text-subtle">{items.length === 1 ? '1 issue' : `${items.length} issues`}</span>} flush className="animate-step-in">
      {groups.map((g, gi) => (
        <section key={g.key} aria-label={g.label} className={cx('px-4 py-3.5 sm:px-5', gi > 0 && 'border-t border-line')}>
          <h3 className={cx('flex items-center gap-1.5 text-[13px] font-semibold', g.tone)}>
            <g.icon aria-hidden className="size-4" /> {g.label}
            <InfoTip label={`About ${g.label.toLowerCase()}`} content={g.tip} />
          </h3>
          <ul className="mt-2 space-y-2.5">
            {g.items.map((i) => {
              const { why, rest } = splitNotFixed(i.reason);
              return (
                <li key={i.rule_id} className="flex gap-3 text-[13px] leading-snug">
                  <span className="mt-px w-6 shrink-0 font-mono text-[11.5px] text-subtle">{i.rule_id}</span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-0.5 font-medium">
                      {title(i.rule_id)}
                      <InfoTip label={`About rule ${i.rule_id}`} title={`${i.rule_id} · ${title(i.rule_id)}`} content={<RuleTipBody meta={meta} id={i.rule_id} />} wide />
                    </p>
                    <p className="mt-0.5 text-muted">{rest}</p>
                    {why && <p className="mt-1 font-mono text-[11.5px] text-subtle">Not automatic: {why}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Panel>
  );
}
