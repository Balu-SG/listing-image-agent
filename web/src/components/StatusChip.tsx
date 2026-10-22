import type { ReactNode } from 'react';
import { Check, Wrench, Camera } from 'lucide-react';
import type { Status } from '../types';
import { STATUS_CHIP, STATUS_LABEL, cx } from '../lib';
import { useMeta } from '../meta';
import { Tooltip } from './Tooltip';

const ICON = { PASS: Check, FIXABLE: Wrench, RESHOOT: Camera } as const;

const FALLBACK: Record<Status, string> = {
  PASS: 'Meets the rule.',
  FIXABLE: 'The agent can fix this without touching the product.',
  RESHOOT: 'Editing cannot fix this; a new photo is needed.',
};

export function StatusChip({
  status,
  size = 'sm',
  label,
  tip = true,
  muted = false,
  tipTitle,
  tipContent,
}: {
  status: Status;
  size?: 'sm' | 'md';
  label?: string;
  tip?: boolean;
  muted?: boolean;
  /** Override the default status explanation. */
  tipTitle?: string;
  tipContent?: ReactNode;
}) {
  const meta = useMeta();
  const Icon = ICON[status];
  const chip = (
    <span
      tabIndex={tip ? 0 : undefined}
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded-md border font-medium whitespace-nowrap',
        size === 'md' ? 'px-2 py-0.5 text-[13px]' : 'px-1.5 py-px text-[11.5px]',
        STATUS_CHIP[status],
        muted && 'opacity-60',
      )}
    >
      <Icon aria-hidden className={size === 'md' ? 'size-3.5' : 'size-3'} strokeWidth={2.25} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
  if (!tip) return chip;
  return (
    <Tooltip title={tipTitle ?? STATUS_LABEL[status]} content={tipContent ?? meta?.metrics.status[status] ?? FALLBACK[status]}>
      {chip}
    </Tooltip>
  );
}
