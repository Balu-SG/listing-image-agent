import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { Result } from '../types';
import { assetUrl } from '../api';
import { Card } from './Card';
import { cx } from '../lib';

export function ProofCard({ result }: { result: Result }) {
  const g = result.guarantee;
  const diff = assetUrl(result.images.diff);
  if (!g) return null;
  const ok = g.passed;
  return (
    <Card
      title="Product unchanged"
      icon={ok ? <ShieldCheck aria-hidden className="size-5" /> : <ShieldAlert aria-hidden className="size-5" />}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        {diff && (
          <figure className="mx-auto w-full max-w-56 sm:mx-0 sm:w-48 sm:shrink-0">
            <img src={diff} alt="Difference map of the product region; black means unchanged" className="aspect-square w-full rounded-xl border border-line bg-black object-contain" />
            <figcaption className="mt-1.5 text-xs text-muted">Difference map, product region. Black = unchanged.</figcaption>
          </figure>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
          <div className={cx('flex items-center gap-3 rounded-xl p-4', ok ? 'bg-pass-soft' : 'bg-bad-soft')}>
            <span className={cx('grid size-10 shrink-0 place-items-center rounded-full text-white', ok ? 'bg-pass' : 'bg-bad')}>
              {ok ? <ShieldCheck aria-hidden className="size-5" /> : <ShieldAlert aria-hidden className="size-5" />}
            </span>
            <div>
              <p className={cx('text-2xl font-bold tabular-nums', ok ? 'text-pass' : 'text-bad')}>
                {g.changed_product_pixels.toLocaleString()}
              </p>
              <p className="text-sm font-medium">Product pixels changed</p>
            </div>
          </div>
          <p className="text-sm text-muted">
            {ok
              ? 'Every edit was checked against the product mask. The product itself is exactly what you uploaded; only background, framing and overlays changed.'
              : 'The guarantee check failed: some product pixels differ from the upload. Review the difference map before using this image.'}
          </p>
        </div>
      </div>
    </Card>
  );
}
