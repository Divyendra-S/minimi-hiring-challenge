"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChatView } from "./ChatView";
import { MenuIcon, PlusIcon } from "./icons";
import { SetupNotice } from "./SetupNotice";
import { Sidebar } from "./Sidebar";

/** The open session lives in the URL (?s=id), so reloads and the back button keep it. */
export function App() {
  const sessionId = useSearchParams().get("s");
  const [menuOpen, setMenuOpen] = useState(false);
  const open = (id: string | null) => {
    window.history.pushState(null, "", id ? `?s=${id}` : "/");
    setMenuOpen(false);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-surface-05 md:py-2 md:pr-2">
      <Sidebar
        selectedId={sessionId}
        onSelect={open}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <main className="gradient-page flex min-w-0 flex-1 flex-col overflow-hidden md:rounded-xl md:shadow-ring">
        <header className="flex h-12 shrink-0 items-center justify-between px-2 md:hidden">
          <button
            type="button"
            aria-label="Open chats"
            onClick={() => setMenuOpen(true)}
            className={iconButton}
          >
            <MenuIcon />
          </button>
          <span className="text-[11px] font-medium tracking-[0.2em] text-text-tertiary uppercase">
            Search Agent
          </span>
          <button
            type="button"
            aria-label="New chat"
            onClick={() => open(null)}
            className={iconButton}
          >
            <PlusIcon />
          </button>
        </header>
        <div className="mx-auto w-full max-w-3xl px-6 pt-4 empty:hidden">
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

const iconButton =
  "flex size-9 items-center justify-center rounded-lg text-text-tertiary transition-colors duration-200 hover:bg-surface-1/50 hover:text-text-secondary";
