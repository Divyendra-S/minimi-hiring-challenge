import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { citedSources, linkCitations } from "@/client/citations";
import type { Source } from "@/shared/events";
import { MarkIcon, UserIcon } from "./icons";
import { hostname, Sources } from "./Sources";
import { StatusLine } from "./StatusLine";

type Author = "user" | "assistant";
export type MessageProps = {
  author: Author;
  content: string;
  sources: Source[];
  /** While an answer has no text yet: the searches running, if any. */
  searching?: string[];
};

const components: Components = {
  a: ({ node: _, href = "", children, ...props }) => {
    // linkCitations turned each [n] into a link whose text is "[n]": show it as a small badge.
    const citation = typeof children === "string" && /^\[(\d+)\]$/.exec(children);
    if (!citation) {
      return (
        <a {...props} href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={hostname(href)}
        className="not-prose ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-1 px-1 align-[1px] text-[10px] leading-none font-medium text-text-tertiary no-underline transition-colors duration-200 hover:bg-accent/90 hover:text-white"
      >
        {citation[1]}
      </a>
    );
  },
};

export function Message({ author, content, sources, searching = [] }: MessageProps) {
  if (author === "user") {
    return (
      <Turn author="user">
        <p className="text-[14px] leading-[1.7] whitespace-pre-wrap break-words">{content}</p>
      </Turn>
    );
  }
  const cited = citedSources(content, sources);
  return (
    <Turn author="assistant" badge={cited.length > 0 ? "web" : undefined}>
      {content ? (
        <div className="prose max-w-none">
          <Markdown remarkPlugins={[remarkGfm]} components={components}>
            {linkCitations(content, sources)}
          </Markdown>
        </div>
      ) : (
        <StatusLine searching={searching} />
      )}
      <Sources sources={cited} />
    </Turn>
  );
}

/** One side of the conversation: an avatar and a small label instead of a chat bubble. */
function Turn({
  author,
  badge,
  children,
}: {
  author: Author;
  badge?: string;
  children: ReactNode;
}) {
  const user = author === "user";
  return (
    <div className="flex items-start gap-3 motion-safe:animate-message-in">
      <div
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
          user ? "bg-surface-2/50 text-text-tertiary" : "bg-accent/10 text-accent"
        }`}
      >
        {user ? <UserIcon className="size-3.5" /> : <MarkIcon className="size-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="text-[10px] font-medium tracking-wider text-text-tertiary uppercase">
            {user ? "You" : "Agent"}
          </span>
          {badge && (
            <span className="rounded-full bg-mode-query/10 px-1.5 py-px text-[9px] font-medium text-mode-query">
              {badge}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
