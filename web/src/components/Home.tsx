import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { RULE_FALLBACK, RULE_IDS, useMeta } from '../meta';
import { Uploader, type UploadPhase } from './Uploader';
import { GalleryCard, GallerySkeleton, useGallery } from './Gallery';
import { Tooltip } from './Tooltip';
import { RuleTipBody, SOURCE_FALLBACK } from './help';

const STEPS = [
  { title: 'Inspect', text: 'OpenCV checks the image against 8 Amazon main-image rules and scores it from 0 to 100.' },
  { title: 'Plan', text: 'Claude on Amazon Bedrock reads the report, not the image, and picks which tools to run.' },
  { title: 'Fix', text: 'Deterministic OpenCV tools make every pixel edit: backdrop, framing, added text and borders.' },
  { title: 'Prove', text: 'Each edit is checked pixel by pixel against the product mask. Any change to the product is rejected.' },
];

export function Home({ phase, onFile, onUrl, onOpen, onGallery }: {
  phase: UploadPhase;
  onFile: (f: File) => void;
  onUrl: (url: string) => void;
  onOpen: (id: string) => void;
  onGallery: () => void;
}) {
  const meta = useMeta();
  const { items } = useGallery();
  const examples = items?.filter((i) => i.state === 'done').slice(0, 6);

  return (
    <div className="mx-auto max-w-[880px]">
      <section className="pt-6 text-center sm:pt-12">
        <p className="font-mono text-[11.5px] tracking-wider text-subtle uppercase">Amazon main-image compliance</p>
        <h1 className="mx-auto mt-4 max-w-2xl text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-[44px]">
          Compliant listing images, product untouched.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted text-pretty sm:text-base">
          Upload a main product image. We check it against Amazon’s rules, an agent fixes what it can, and every edit is
          verified so the product itself never changes.
        </p>
      </section>

      <div className="mt-8 sm:mt-10">
        <Uploader phase={phase} onFile={onFile} onUrl={onUrl} />
      </div>

      <section aria-labelledby="examples" className="mt-10">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="examples" className="text-[13px] font-semibold">
            Or try an example
          </h2>
          <button type="button" onClick={onGallery} className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">
            View gallery <ArrowRight aria-hidden className="size-3.5" />
          </button>
        </div>
        {items && !examples?.length ? (
          <p className="text-sm text-subtle">No examples yet.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-6" aria-busy={!examples}>
            {!examples ? (
              <GallerySkeleton count={6} compact />
            ) : (
              examples.map((item) => (
                <li key={item.id}>
                  <GalleryCard item={item} onOpen={onOpen} compact />
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <section aria-labelledby="how" className="mt-14 sm:mt-16">
        <h2 id="how" className="text-[13px] font-semibold">
          How it works
        </h2>
        <ol className="mt-3 grid gap-px overflow-hidden rounded-xl border border-line bg-line shadow-xs sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="bg-surface p-5">
              <div className="flex items-center gap-2">
                <span className="num grid size-5 place-items-center rounded-md bg-surface-2 font-mono text-[11px] font-medium text-muted ring-1 ring-line">
                  {i + 1}
                </span>
                <h3 className="text-sm font-semibold">{s.title}</h3>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="rules" className="mt-12">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="rules" className="text-[13px] font-semibold">
            The 8 rules we check
          </h2>
          <a
            href={(meta?.source ?? SOURCE_FALLBACK).url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-xs text-subtle hover:text-fg hover:underline"
          >
            Source: Amazon Seller Central <ArrowUpRight aria-hidden className="size-3" />
          </a>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {RULE_IDS.map((id) => (
            <li key={id} className="min-w-0">
              <Tooltip title={meta?.rules[id]?.title ?? RULE_FALLBACK[id]} content={<RuleTipBody meta={meta} id={id} />} wide className="w-full">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-left text-[13px] shadow-xs transition-colors hover:border-line-strong"
                >
                  <span className="font-mono text-[11.5px] text-subtle">{id}</span>
                  <span className="truncate font-medium">{meta?.rules[id]?.title ?? RULE_FALLBACK[id]}</span>
                </button>
              </Tooltip>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-subtle">
          Hover or focus a rule to see Amazon’s wording and how we check it.
          {meta?.not_checked?.length ? ` ${meta.not_checked.length} further Amazon rules (one unit only, no props, footwear angle…) need a human eye and are not checked automatically.` : ''}
        </p>
      </section>
    </div>
  );
}
