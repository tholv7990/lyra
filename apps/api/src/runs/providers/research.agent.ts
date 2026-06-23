import type { EvidenceClaim, SourceRow, ConfidenceKind } from '@lyra/shared';
import type { SearchHit } from './tavily.client';

export interface ResearchCaps { maxRounds: number; maxSearchesPerRound: number; maxSources: number; maxLlmCalls: number; }
export interface ResearchDeps {
  search(query: string): Promise<SearchHit[]>;
  llm(system: string, prompt: string): Promise<string>;
  checkAlive(url: string): Promise<boolean>;
  caps: ResearchCaps;
}
export interface ResearchResult { claims: EvidenceClaim[]; sources: SourceRow[]; rounds: number; llmCalls: number; droppedClaims: number; droppedUnsupported: number; }

const PLAN_SYS = 'PLAN: You generate web-search queries. Reply ONLY JSON {"queries":["..."]} — concise, grounded queries to answer the question.';
const EXTRACT_SYS = 'EXTRACT: From the provided sources ONLY, extract factual claims. Reply ONLY JSON {"claims":[{"statement","value?","kind":"verified|calculated|estimate|assumption","sourceId","quote","geography?","period?","demandSignal?":bool,"purchaseData?":bool}]}. Every claim MUST set sourceId to one of the given source ids AND set "quote" to a short snippet (<=200 chars) copied VERBATIM (word-for-word) from that source supporting the claim. Claims whose quote is not found verbatim in the source are discarded. Never assert anything not supported by a source.';
const REFLECT_SYS = 'REFLECT: Given the claims so far, decide if there is enough independent evidence (aim for >=3 demand signals). Reply ONLY JSON {"enough":bool,"followupQueries":["..."]}.';

function parseJson<T>(text: string, fallback: T): T {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return fallback;
  try { return JSON.parse(m[0]) as T; } catch { return fallback; }
}

// Loose verbatim match for grounding: case- and whitespace-insensitive substring.
const normText = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// Bounded agentic research loop. Grounding is enforced HERE, not by the LLM:
// SourceRows are created by code (id/accessDate/alive), and any claim citing an
// unknown sourceId is dropped. Pure over its injected effects → unit-testable.
export async function runResearch(question: string, deps: ResearchDeps): Promise<ResearchResult> {
  const { caps } = deps;
  const sources: SourceRow[] = [];
  const byUrl = new Map<string, SourceRow>();
  const contentById = new Map<string, string>();
  const claims: EvidenceClaim[] = [];
  let llmCalls = 0;
  let droppedClaims = 0;
  let droppedUnsupported = 0;
  let claimSeq = 0;

  const callLlm = async (system: string, prompt: string): Promise<string> => {
    llmCalls++;
    return deps.llm(system, prompt);
  };
  const capHit = () => llmCalls >= caps.maxLlmCalls;

  // Ingest hits → new SourceRows (dedupe by url, cap total). Returns rows added + their content.
  const ingest = (hits: SearchHit[]): { row: SourceRow; content: string }[] => {
    const added: { row: SourceRow; content: string }[] = [];
    for (const h of hits) {
      if (!h.url || byUrl.has(h.url)) continue;
      if (sources.length >= caps.maxSources) break;
      const content = (h.content ?? '').slice(0, 4000);
      const row: SourceRow = {
        id: `s${sources.length + 1}`,
        name: h.title || h.url,
        url: h.url,
        accessDate: new Date().toISOString(),
        primary: false,
        alive: true,
      };
      sources.push(row); byUrl.set(h.url, row); contentById.set(row.id, content);
      added.push({ row, content });
    }
    return added;
  };

  // PLAN
  let queries: string[] = [];
  if (!capHit()) {
    const plan = parseJson<{ queries?: string[] }>(await callLlm(PLAN_SYS, question), {});
    queries = (plan.queries ?? []).slice(0, caps.maxSearchesPerRound);
  }
  if (queries.length === 0) queries = [question];

  let rounds = 0;
  for (let round = 0; round < caps.maxRounds; round++) {
    rounds = round + 1;
    const roundHits: SearchHit[] = [];
    for (const q of queries.slice(0, caps.maxSearchesPerRound)) {
      try { roundHits.push(...(await deps.search(q))); } catch { /* skip failed query */ }
      if (sources.length >= caps.maxSources) break;
    }
    const newRows = ingest(roundHits);
    if (newRows.length === 0) break; // dry round (no new sources) → stop, don't burn a reflect call

    if (!capHit() && newRows.length) {
      const corpus = newRows.map((n) => `[${n.row.id}] ${n.row.name} (${n.row.url})\n${n.content}`).join('\n\n');
      const ex = parseJson<{ claims?: RawClaim[] }>(await callLlm(EXTRACT_SYS, `Question: ${question}\n\nSources:\n${corpus}`), {});
      for (const c of ex.claims ?? []) {
        if (!c || !byId(sources, c.sourceId)) { droppedClaims++; continue; } // anti-hallucination: unknown source
        const quote = typeof c.quote === 'string' ? c.quote : '';
        // ponytail: substring match, not semantic entailment — a present-but-irrelevant
        // quote slips through. Upgrade path: one batched LLM entailment pass if false-drops bite.
        if (!quote || !normText(contentById.get(c.sourceId as string) ?? '').includes(normText(quote))) {
          droppedUnsupported++; continue; // grounding: the source must actually contain the supporting span
        }
        claims.push({
          id: `c${++claimSeq}`,
          statement: String(c.statement ?? '').slice(0, 1000),
          value: c.value,
          kind: normalizeKind(c.kind),
          sourceId: c.sourceId as string,
          quote: quote.slice(0, 300),
          geography: c.geography,
          period: c.period,
          demandSignal: !!c.demandSignal,
          purchaseData: !!c.purchaseData,
        });
      }
    }

    if (capHit()) break;
    const ref = parseJson<{ enough?: boolean; followupQueries?: string[] }>(
      await callLlm(REFLECT_SYS, `Question: ${question}\nClaims so far: ${claims.length}\n${claims.map((c) => '- ' + c.statement).join('\n')}`),
      { enough: true },
    );
    if (ref.enough || round === caps.maxRounds - 1) break;
    queries = (ref.followupQueries ?? []).slice(0, caps.maxSearchesPerRound);
    if (queries.length === 0) break;
  }

  // DEAD-LINK SWEEP (best-effort; never throws)
  for (const s of sources) {
    try { s.alive = await deps.checkAlive(s.url); } catch { s.alive = false; }
  }

  return { claims, sources, rounds, llmCalls, droppedClaims, droppedUnsupported };
}

interface RawClaim { statement?: unknown; value?: number | string; kind?: unknown; sourceId?: string; quote?: string; geography?: string; period?: string; demandSignal?: boolean; purchaseData?: boolean; }
function byId(rows: SourceRow[], id?: string): boolean { return !!id && rows.some((r) => r.id === id); }
function normalizeKind(k: unknown): ConfidenceKind {
  return k === 'verified' || k === 'calculated' || k === 'assumption' ? k : 'estimate';
}
