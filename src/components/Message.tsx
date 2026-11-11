import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { citedSources, linkCitations } from "@/client/citations";
import type { Source } from "@/shared/events";
import { Sources } from "./Sources";

type Props = { author: "user" | "assistant"; content: string; sources: Source[] };

const components: Components = {
  a: ({ node: _, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
};

export function Message({ author, content, sources }: Props) {
  if (author === "user") {
    return (
      <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl bg-neutral-100 px-4 py-2">
        {content}
      </div>
    );
  }
  return (
    <div>
      <div className="prose prose-neutral max-w-none prose-a:text-blue-700">
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {linkCitations(content, sources)}
        </Markdown>
      </div>
      <Sources sources={citedSources(content, sources)} />
    </div>
  );
}
