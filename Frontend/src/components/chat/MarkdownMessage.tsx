import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  content: string;
}

/** Renders assistant chat content as Markdown (GFM). Raw HTML is NOT enabled
 *  (no rehype-raw), so embedded HTML is escaped — XSS-safe by construction.
 *  Elements are styled with the app's tokens (no @tailwindcss/typography). */
export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-dark-accent underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isBlock = (className || '').includes('language-');
            if (isBlock) {
              return (
                <code className={`block whitespace-pre overflow-x-auto rounded-lg bg-dark-bg/60 border border-dark-border p-3 text-xs font-mono ${className || ''}`}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-dark-bg/60 border border-dark-border px-1.5 py-0.5 text-[0.85em] font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-dark-border pl-3 italic text-dark-textSec">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-dark-border px-2 py-1 text-left font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-dark-border px-2 py-1">{children}</td>,
          hr: () => <hr className="border-dark-border my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownMessage;
