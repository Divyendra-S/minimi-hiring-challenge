import { z } from "zod";
import type { Source } from "./events";

/** Response of GET /api/health. */
export type Health = {
  missingEnv: string[];
  sqlite: { version: string; fts5: boolean };
};

export type SessionSummary = { id: string; title: string; updatedAt: string };

export type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  createdAt: string;
};

const TimeZone = z.string().refine(isTimeZone, "Unknown IANA time zone");

/** Body of POST /api/chat. */
export const ChatRequest = z.object({
  sessionId: z.string().optional(),
  message: z.string().trim().min(1).max(8000),
  timezone: TimeZone,
});
export type ChatRequest = z.infer<typeof ChatRequest>;

/** Body of POST /api/demo: the demo chats are dated in the user's time zone. */
export const DemoRequest = z.object({ timezone: TimeZone });

/** Demo chats are titled "Demo: ...", so they're never mistaken for real ones. */
export const DEMO_TITLE = "Demo: ";

export function isDemo(session: SessionSummary): boolean {
  return session.title.startsWith(DEMO_TITLE);
}

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}
