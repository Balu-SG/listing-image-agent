import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Meta, RuleHelp, ToolHelp } from './types';
import { fallbackToolLabel } from './lib';

/**
 * Help text for tooltips comes from GET /api/meta. It is fetched once and cached for the
 * session; if it fails the UI still works, tooltips just fall back to shorter copy.
 */
let cached: Promise<Meta | null> | null = null;
function loadMeta(): Promise<Meta | null> {
  if (!cached) cached = api.meta().catch(() => null);
  return cached;
}

const MetaContext = createContext<Meta | null>(null);

export function MetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    let alive = true;
    void loadMeta().then((m) => alive && setMeta(m));
    return () => {
      alive = false;
    };
  }, []);
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>;
}

export function useMeta(): Meta | null {
  return useContext(MetaContext);
}

export function toolLabel(meta: Meta | null, tool: string): string {
  return meta?.tools[tool]?.label ?? fallbackToolLabel(tool);
}

export function toolHelp(meta: Meta | null, tool: string): ToolHelp | undefined {
  return meta?.tools[tool];
}

export function ruleHelp(meta: Meta | null, id: string): RuleHelp | undefined {
  return meta?.rules[id];
}

/** The eight rules, used on the home page before anything is inspected. */
export const RULE_IDS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];
export const RULE_FALLBACK: Record<string, string> = {
  R1: 'Pure white background',
  R2: 'Product fills 85% of the image',
  R3: 'Image size',
  R4: 'No added text or badges',
  R5: 'No border or frame',
  R6: 'Sharp, in focus',
  R7: 'Whole product in frame',
  R8: 'Exposure',
};
