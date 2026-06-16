import { useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// A fenced code block with a hover "Copy" button (Claude-style).
function CodeBlock({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  function copy() {
    const text = ref.current?.innerText ?? '';
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }
  return (
    <div className="md-code">
      <button type="button" className="md-copy" onClick={copy}>
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
