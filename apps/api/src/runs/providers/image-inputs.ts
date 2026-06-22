import { parseImageRefs } from '@lyra/shared';
import type { StepInputImage } from './step-provider.interface';

// Fetch an image URL to base64. data: URLs are decoded inline (no network); http(s)
// URLs are fetched. Returns null on any failure (a missing input degrades the step
// to text→image, never a hard failure).
export async function fetchImageAsBase64(url: string): Promise<StepInputImage | null> {
  try {
    const m = /^data:([^;]+);base64,(.*)$/.exec(url);
    if (m) return { url, mime: m[1], b64: m[2] };
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') || 'image/png';
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    return { url, mime, b64 };
  } catch {
    return null;
  }
}

// Resolve a step's {input}/{step:Name} references to prior steps' IMAGE assets and
// fetch them to base64. {input} = the most recent earlier step that has an image;
// {step:Name} = each named earlier step. Capped (default 4). Failures are skipped.
export async function gatherInputImages(
  prompt: string,
  steps: { name?: string }[],
  index: number,
  assetsForStep: (stepIndex: number) => { type: string; url: string }[],
  cap = 4,
): Promise<StepInputImage[]> {
  const { input, names } = parseImageRefs(prompt);
  const refIdx = new Set<number>();
  if (input) {
    for (let i = index - 1; i >= 0; i--) {
      if (assetsForStep(i).some((a) => a.type === 'image')) { refIdx.add(i); break; }
    }
  }
  for (const nm of names) {
    const i = steps.findIndex((s, k) => k < index && (s.name ?? '').toLowerCase() === nm.toLowerCase());
    if (i >= 0) refIdx.add(i);
  }
  const urls = [...refIdx]
    .sort((a, b) => a - b)
    .flatMap((i) => assetsForStep(i).filter((a) => a.type === 'image').map((a) => a.url))
    .slice(0, cap);
  const fetched = await Promise.all(urls.map(fetchImageAsBase64));
  return fetched.filter((x): x is StepInputImage => x !== null);
}
