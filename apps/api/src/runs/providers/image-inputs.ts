import { parseImageRefs } from '@lyra/shared';
import type { StepInputImage } from './step-provider.interface';

// Maximum image size accepted (bytes). Larger payloads are rejected to prevent
// OOM on parallel fetches that each base64-inflate the body (+33%).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

// Returns true for private/loopback/link-local hostnames and IP ranges that
// must not be reached from the server side (SSRF defence — defense-in-depth).
// ponytail: literal-host SSRF guard only — does not resolve DNS, so a hostname
// that resolves to a private IP is not caught here. Full protection needs a
// resolve-then-check step (e.g. via a custom DNS resolver or an egress proxy).
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  // Loopback / localhost
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  // IPv6 loopback
  if (h === '::1' || h === '[::1]') return true;
  // All-zeros
  if (h === '0.0.0.0') return true;
  // IPv4 private/loopback/link-local ranges
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (a === 127) return true;                              // 127.x.x.x loopback
    if (a === 10) return true;                               // 10.x.x.x private
    if (a === 192 && b === 168) return true;                 // 192.168.x.x private
    if (a === 169 && b === 254) return true;                 // 169.254.x.x link-local
    if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16-31.x.x private
  }
  return false;
}

// Fetch an image URL to base64. data: URLs are decoded inline (no network); http(s)
// URLs are fetched with:
//  - scheme check: only http: / https: allowed (rejects file:, ftp:, etc.)
//  - host block: private/loopback/link-local ranges rejected (SSRF defence)
//  - size cap: Content-Length header + actual buffer both checked against 10 MB
// Returns null on any failure (a missing input degrades the step to text→image,
// never a hard failure).
export async function fetchImageAsBase64(url: string): Promise<StepInputImage | null> {
  try {
    // data: URL — decode inline, no network call.
    const m = /^data:([^;]+);base64,(.*)$/.exec(url);
    if (m) {
      // Size cap on the raw base64 payload (base64 is ~4/3× the binary size).
      const byteLen = Math.ceil(m[2].length * 0.75);
      if (byteLen > MAX_IMAGE_BYTES) return null;
      return { url, mime: m[1], b64: m[2] };
    }

    // Parse URL — validates scheme and extracts hostname for the SSRF check.
    let parsed: URL;
    try { parsed = new URL(url); } catch { return null; }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (isBlockedHost(parsed.hostname)) return null;

    // Reject on Content-Length before reading the body (fast path).
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const clHeader = res.headers.get('content-length');
    if (clHeader !== null && Number(clHeader) > MAX_IMAGE_BYTES) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) return null;

    const mime = res.headers.get('content-type') || 'image/png';
    const b64 = buf.toString('base64');
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
