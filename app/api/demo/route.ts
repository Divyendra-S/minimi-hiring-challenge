import { z } from "zod";
import { seedDemo } from "@/core/memory/demo";
import { getMemories, getStore } from "@/server/services";
import { getUserId } from "@/server/user";
import { DemoRequest, isDemo } from "@/shared/dto";

/** Adds the demo chats to the user's history, so recall can be tried right away. */
export async function POST(request: Request): Promise<Response> {
  const parsed = DemoRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  const userId = await getUserId();
  const store = getStore();
  // The same check as the sidebar's, which hides the button once the demo is loaded.
  if (store.listSessions(userId).some(isDemo)) {
    return Response.json({ error: "The demo history is already loaded." }, { status: 409 });
  }
  seedDemo({ store, memories: getMemories() }, userId, new Date(), parsed.data.timezone);
  return new Response(null, { status: 204 });
}
