import type { ReactNode } from 'react';

// Split prompt text into plain runs + {variable} runs, returning React nodes with
// the variables wrapped in a highlight span — the shared renderer for the
// marketplace + prompt detail prompt blocks.
export function promptSegments(content: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\{[^{}]+\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) out.push(content.slice(last, m.index));
    out.push(
      <span key={`v${i++}`} className="mkd-var-hl">
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < content.length) out.push(content.slice(last));
  return out;
}
