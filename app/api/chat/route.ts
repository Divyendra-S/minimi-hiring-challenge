import { after } from "next/server";
import { z } from "zod";
import { ConfigError } from "@/config";
import { chat } from "@/core/chat";
import { chatDeps, remember } from "@/server/services";
import { ndjsonResponse } from "@/server/stream";
import { getUserId } from "@/server/user";
import { ChatRequest } from "@/shared/dto";

export async function POST(request: Request): Promise<Response> {
  const parsed = ChatRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }
  try {
    const deps = chatDeps();
    const userId = await getUserId();
    // Runs once the stream has closed (tested: after the last event, or right after a Stop).
    after(() => remember(userId));
    return ndjsonResponse(chat(deps, { userId, ...parsed.data }, request.signal), request.signal);
  } catch (error) {
    if (error instanceof ConfigError)
      return Response.json({ error: error.message }, { status: 503 });
    throw error;
  }
}
