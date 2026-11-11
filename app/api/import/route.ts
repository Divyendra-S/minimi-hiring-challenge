import { after } from "next/server";
import { z } from "zod";
import { ImportedChats, importChats } from "@/core/memory/import";
import { getMemories, getStore, remember } from "@/server/services";
import { getUserId } from "@/server/user";
import type { ImportStatus } from "@/shared/dto";

/** How many imported or new turns still wait for memory extraction. */
export async function GET(): Promise<Response> {
  const status: ImportStatus = { pending: getMemories().pending(await getUserId()).length };
  return Response.json(status);
}

/**
 * Adds past chats to the user's history. The chats are saved at once; their memories are then
 * extracted in the background, one model call per turn, by the same job that follows a live turn.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = ImportedChats.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const userId = await getUserId();
  const imported = importChats(getStore(), userId, parsed.data);
  after(() => remember(userId));
  return Response.json(imported);
}
