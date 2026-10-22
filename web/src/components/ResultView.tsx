import type { Result } from '../types';
import { useMeta } from '../meta';
import { Panel } from './Card';
import { ImageViewer } from './ImageViewer';
import { ScorePanel } from './ScorePanel';
import { RulesList } from './RulesList';
import { AgentCapabilities, AgentTimeline } from './AgentTimeline';
import { ProofCard } from './ProofCard';
import { VisibilityCard } from './VisibilityCard';
import { InfoTip } from './Tooltip';
import { NeedsAttention } from './NeedsAttention';

export function ResultView({
  result,
  fixing,
  onFix,
  onReset,
}: {
  result: Result;
  fixing: boolean;
  onFix: () => void;
  onReset: () => void;
}) {
  const meta = useMeta();
  const done = result.state === 'done';
  const running = result.state === 'running' || (fixing && result.state === 'analyzed');
  const started = running || done || result.steps.length > 0;
  const showProof = done && !!result.guarantee;

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 lg:col-span-7">
          <div className="lg:sticky lg:top-[76px]">
            <ImageViewer result={result} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
          <ScorePanel result={result} running={running} onFix={onFix} onReset={onReset} />

          {done && result.summary && (
            <Panel
              title="Agent summary"
              help={
                result.planner ? (
                  <InfoTip
                    label="About the planner"
                    title={result.planner === 'claude' ? 'Written by Claude on Bedrock' : 'Written by the rule planner'}
                    content={meta?.metrics.planner[result.planner]}
                  />
                ) : undefined
              }
              className="animate-step-in"
            >
              <p className="text-[14px] leading-relaxed text-pretty">{result.summary}</p>
            </Panel>
          )}

          {/* The summary refers to "the list below": keep it directly under the summary. */}
          {done && <NeedsAttention result={result} />}

          <RulesList before={result.before} after={result.after} notFixed={done ? result.needs_reshoot : []} />

          {started ? <AgentTimeline result={result} running={running} /> : <AgentCapabilities result={result} />}

          {/* Before a fix there is nothing to prove yet, so visibility sits in this column. */}
          {!showProof && <VisibilityCard key={result.id} before={result.visibility_before} after={result.visibility_after} />}
        </div>
      </div>

      {showProof && (
        <div className="mt-5 grid items-stretch gap-5 lg:mt-6 lg:grid-cols-2 lg:gap-6">
          <ProofCard result={result} />
          <VisibilityCard key={result.id + '-after'} before={result.visibility_before} after={result.visibility_after} />
        </div>
      )}
    </div>
  );
}

export function ResultSkeleton() {
  return (
    <div role="status" aria-label="Loading result" className="grid gap-5 lg:grid-cols-12 lg:gap-6">
      <div className="overflow-hidden rounded-xl border border-line bg-surface lg:col-span-7">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="space-y-1.5">
            <div className="skeleton h-3.5 w-40" />
            <div className="skeleton h-2.5 w-28" />
          </div>
          <div className="skeleton h-7 w-48" />
        </div>
        <div className="skeleton aspect-square rounded-none" />
      </div>
      <div className="flex flex-col gap-5 lg:col-span-5">
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-center gap-4">
            <div className="skeleton size-[76px] rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-5 w-32" />
              <div className="skeleton h-3 w-28" />
            </div>
          </div>
          <div className="skeleton mt-5 h-11 w-full" />
        </div>
        <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="skeleton h-3.5 w-1/2" />
              <div className="skeleton h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
