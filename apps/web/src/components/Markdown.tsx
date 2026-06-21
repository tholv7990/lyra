import { useRef, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCopyToClipboard } from '../lib/useCopyToClipboard';

// A fenced code block with a hover "Copy" button (Claude-style).
function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const { copied, copy } = useCopyToClipboard();
  return (
    <div className="md-code">
      <button type="button" className="md-copy" onClick={() => copy(ref.current?.innerText ?? '')}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}

// Renders an assistant message as GitHub-flavored Markdown. Links open in a new
// tab; code fences get a copy button. Used in the prompt-testing chat.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
