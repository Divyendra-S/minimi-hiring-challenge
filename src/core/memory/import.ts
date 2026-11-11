import { z } from "zod";
import type { Store } from "./store";

const MAX_CHATS = 200;
const MAX_MESSAGES_PER_CHAT = 100;
const MAX_CHARS = 20_000;
const TITLE_CHARS = 60;
const MINUTE_MS = 60_000;

const ImportedMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_CHARS),
  /** The pages an answer cites, in order: the first is [1] in its text. */
  sources: z.array(z.object({ title: z.string().optional(), url: z.url() })).optional(),
});

const ImportedChat = z.object({
  title: z.string().trim().min(1).optional(),
  /** When the chat began: "2026-11-03" or "2026-11-03T14:30:00Z". */
  date: z.string().refine((date) => !Number.isNaN(Date.parse(date)), "Not a date"),
  messages: z
    .array(ImportedMessage)
    .min(2)
    .max(MAX_MESSAGES_PER_CHAT)
    .refine(
      (messages) =>
        messages.length % 2 === 0 &&
        messages.every(({ role }, i) => role === (i % 2 === 0 ? "user" : "assistant")),
      "Messages must alternate user and assistant, starting with user and ending with assistant",
    ),
});

/** Body of POST /api/import: past chats from anywhere, in the common role-and-content shape. */
export const ImportedChats = z.array(ImportedChat).min(1).max(MAX_CHATS);
export type ImportedChats = z.infer<typeof ImportedChats>;

/**
 * Writes past chats into the user's message log, dated as given. It writes no memories: the
 * caller then runs the same extraction a live turn gets, so an imported chat and a typed one
 * are remembered in the same way.
 */
export function importChats(
  store: Store,
  userId: string,
  chats: ImportedChats,
): { chats: number; turns: number } {
  let turns = 0;
  for (const chat of chats) {
    const start = startOf(chat.date);
    const at = (minutes: number) => new Date(start + minutes * MINUTE_MS).toISOString();
    const title = chat.title ?? chat.messages[0]?.content ?? "";
    const sessionId = store.createSession(userId, title.slice(0, TITLE_CHARS), at(0));
    chat.messages.forEach((message, i) => {
      store.addMessage({
        sessionId,
        userId,
        role: message.role,
        content: message.content,
        sources: message.sources?.map((source, n) => ({
          n: n + 1,
          title: source.title ?? source.url,
          url: source.url,
        })),
        createdAt: at(i),
      });
    });
    turns += chat.messages.length / 2;
  }
  return { chats: chats.length, turns };
}

/** A date without a time is taken as noon UTC: the same calendar day in nearly every zone. */
function startOf(date: string): number {
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00Z` : date);
}
