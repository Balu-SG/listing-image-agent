import type { Status } from '../types';
import { STATUS_TEXT, cx } from '../lib';

/** Thin circular 0-100 gauge, coloured by status. */
export function ScoreRing({
  score,
  status,
  size = 72,
  label,
  dim = false,
}: {
  score: number;
  status: Status;
  size?: number;
  label?: string;
  dim?: boolean;
}) {
  const stroke = Math.max(3, Math.round(size * 0.055));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div
      className={cx('relative inline-grid shrink-0 place-items-center', STATUS_TEXT[status], dim && 'opacity-70')}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? 'Score'} ${Math.round(score)} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.2,0.8,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="num font-semibold tracking-tight text-fg" style={{ fontSize: Math.round(size * 0.32) }}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}
