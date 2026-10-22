import { CheckCircle2, Wrench, Camera } from 'lucide-react';
import type { Status } from '../types';
import { STATUS_CHIP, STATUS_LABEL, cx } from '../lib';

const ICON = { PASS: CheckCircle2, FIXABLE: Wrench, RESHOOT: Camera } as const;

export function StatusChip({ status, size = 'sm' }: { status: Status; size?: 'sm' | 'md' }) {
  const Icon = ICON[status];
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded-full font-semibold',
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs',
        STATUS_CHIP[status],
      )}
    >
      <Icon aria-hidden className={size === 'md' ? 'size-4' : 'size-3.5'} />
      {STATUS_LABEL[status]}
    </span>
  );
}
