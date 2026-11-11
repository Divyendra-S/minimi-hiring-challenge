import { DEMO_TITLE } from "@/shared/dto";
import { DEMO_CHATS, type DemoChat } from "./demo-chats";
import type { MemoryStore } from "./memories";
import type { Store } from "./store";

/** The three chats the brief's sample prompts refer to, on their own. */
export const BRIEF_CHATS = DEMO_CHATS.filter((chat) => chat.brief);

/** Writes sample chats and their memories into the user's history, so recall can be tried
 * without waiting a week. Their titles say they are demo data. */
export function seedDemo(
  deps: { store: Store; memories: MemoryStore },
  userId: string,
  now: Date,
  timeZone: string,
  chats: DemoChat[] = DEMO_CHATS,
): void {
  for (const chat of chats) {
    const topic = chat.topic ?? chat.title;
    const start = chat.at(now, timeZone).getTime();
    const minutesIn = (n: number) => new Date(start + n * 60_000).toISOString();
    const sessionId = deps.store.createSession(userId, DEMO_TITLE + chat.title, minutesIn(0));
    chat.turns.forEach((turn, i) => {
      const asked = { sessionId, userId, createdAt: minutesIn(4 * i) };
      deps.store.addMessage({ ...asked, role: "user", content: turn.question });
      const at = minutesIn(4 * i + 1);
      const answerId = deps.store.addMessage({
        sessionId,
        userId,
        role: "assistant",
        content: turn.answer,
        sources: turn.sources,
        createdAt: at,
      });
      deps.memories.save(
        userId,
        { sessionId, answerId, at },
        turn.memories.map((memory) => ({ ...memory, topic })),
      );
    });
  }
}
