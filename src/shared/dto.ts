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

/** Body of POST /api/chat. */
export const ChatRequest = z.object({
  sessionId: z.string().optional(),
  message: z.string().trim().min(1).max(8000),
  timezone: z.string().refine(isTimeZone, "Unknown IANA time zone"),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}
