import type { ChatEvent } from "@/shared/events";
import { encodeLine } from "@/shared/ndjson";

/**
 * Streams events as NDJSON. A failure mid-stream becomes an error event the UI can show.
 * `signal` is the request's: once the client has gone, Next.js has already closed the stream.
 */
export function ndjsonResponse(events: AsyncGenerator<ChatEvent>, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const send = (event: ChatEvent) => encoder.encode(encodeLine(event));

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (signal.aborted) return;
        if (done) controller.close();
        else controller.enqueue(send(value));
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);
        controller.enqueue(send({ type: "error", message }));
        controller.close();
      }
    },
    // The client went away (closed tab, Stop): end the generator so it stops work.
    async cancel() {
      await events.return(undefined);
    },
  });

  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
