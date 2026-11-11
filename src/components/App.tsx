"use client";

import { useSearchParams } from "next/navigation";
import { ChatView } from "./ChatView";
import { SetupNotice } from "./SetupNotice";
import { Sidebar } from "./Sidebar";

/** The open session lives in the URL (?s=id), so reloads and the back button keep it. */
export function App() {
  const sessionId = useSearchParams().get("s");
  const open = (id: string | null) => window.history.pushState(null, "", id ? `?s=${id}` : "/");

  return (
    <div className="flex h-dvh">
      <Sidebar selectedId={sessionId} onSelect={open} />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-3xl px-4 pt-4 empty:hidden">
          <SetupNotice />
        </div>
        <ChatView
          sessionId={sessionId}
          onSession={(id) => window.history.replaceState(null, "", `?s=${id}`)}
        />
      </main>
    </div>
  );
}
