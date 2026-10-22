import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { Result } from '../types';
import { assetUrl } from '../api';
import { cx, fmt } from '../lib';
import { useMeta } from '../meta';
import { Panel } from './Card';
import { InfoTip } from './Tooltip';

export function ProofCard({ result }: { result: Result }) {
  const meta = useMeta();
  const g = result.guarantee;
  if (!g) return null;
  const diff = assetUrl(result.images.diff);
  const roundTrip = g.psnr_db !== null && g.psnr_db !== undefined;
  const ok = g.passed;
  const applied = result.steps.filter((s) => s.outcome === 'applied' && s.tool !== 'finish').length;
  const share = g.product_pixels ? (g.changed_product_pixels / g.product_pixels) * 100 : 0;

  const facts: { label: string; value: string; tip?: string }[] = [
    { label: 'Product pixels compared', value: g.product_pixels ? fmt(g.product_pixels) : '–' },
    {
      label: 'Method',
      value: roundTrip ? 'Round trip' : 'Exact match',
      tip: roundTrip
        ? 'The 2x upscale resamples every pixel, so the result is shrunk back to the original size and compared. PSNR (peak signal-to-noise ratio) of 35 dB or more means visually identical.'
        : 'Each original product pixel is mapped onto the new image and compared value by value.',
    },
    { label: 'Edits verified', value: String(applied) },
    { label: 'Planner', value: result.planner === 'claude' ? 'Claude on Bedrock' : result.planner === 'rules' ? 'Rule planner' : '–', tip: result.planner ? meta?.metrics.planner[result.planner] : undefined },
  ];

  return (
    <Panel
      title="Product unchanged"
      help={
        <InfoTip
          label="About the product guarantee"
          title="Product guarantee"
          content={meta?.metrics.guarantee ?? 'After every edit, the original product pixels are compared with the new image. Any edit that changes them is rejected.'}
          wide
        />
      }
      className="flex h-full flex-col"
      bodyClassName="flex-1"
    >
      <div className="mb-4">
        <div className="flex items-start gap-3">
          <span className={cx('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border', ok ? 'border-pass-line bg-pass-soft text-pass' : 'border-bad-line bg-bad-soft text-bad')}>
            {ok ? <ShieldCheck aria-hidden className="size-4" /> : <ShieldAlert aria-hidden className="size-4" />}
          </span>
          <div className="min-w-0">
            {roundTrip && ok ? (
              <>
                <p className="text-[17px] font-semibold tracking-[-0.01em]">Verified by round trip</p>
                <p className="num mt-0.5 font-mono text-[13px] text-pass">PSNR {g.psnr_db!.toFixed(1)} dB</p>
              </>
            ) : (
              <>
                <p className={cx('num text-[17px] font-semibold tracking-[-0.01em]', !ok && 'text-bad')}>
                  {fmt(g.changed_product_pixels)} product {g.changed_product_pixels === 1 ? 'pixel' : 'pixels'} changed
                </p>
                <p className={cx('mt-0.5 text-[13px]', ok ? 'text-pass' : 'text-bad')}>{ok ? 'Guarantee passed' : 'Guarantee failed'}</p>
              </>
            )}
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          {!ok
            ? 'Some product pixels differ from the upload. Review the difference map before using this image.'
            : roundTrip
              ? `The image was upscaled 2x, which resamples every pixel. Shrunk back and compared, ${fmt(g.changed_product_pixels)} of ${fmt(g.product_pixels)} product pixels (${share < 0.01 && share > 0 ? '<0.01' : share.toFixed(2)}%) differ by more than 24 levels; all other edits changed none.`
              : 'Every edit was checked against the product mask. The product is exactly what you uploaded; only the backdrop and framing changed.'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <figure className="min-w-0">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-black">
            {diff && <img src={diff} alt="Difference map of the product region. Grey is the compared product area; red would mark changed pixels." className="size-full object-contain" />}
          </div>
          <figcaption className="mt-2 flex items-center gap-1 text-xs text-subtle">
            Difference map
            <InfoTip label="About the difference map" title="Difference map" content={meta?.metrics.diff_map ?? 'Black means unchanged.'} />
          </figcaption>
        </figure>
        <dl className="grid content-start gap-px self-start overflow-hidden rounded-lg border border-line bg-line text-[12.5px]">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0 bg-surface px-3 py-2">
              <dt className="flex items-center gap-0.5 text-subtle">
                {f.label}
                {f.tip && <InfoTip label={`About ${f.label.toLowerCase()}`} content={f.tip} className="size-4" />}
              </dt>
              <dd className="num mt-0.5 font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Panel>
  );
}
