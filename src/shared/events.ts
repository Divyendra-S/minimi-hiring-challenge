/** A web page the answer can cite as [n]. Numbers are unique within one answer. */
export type Source = { n: number; title: string; url: string; published?: string };

/** One line of the POST /api/chat NDJSON stream. */
export type ChatEvent =
  // The question is saved. The answer will be saved as `answerId`; a stopped one keeps what streamed.
  | { type: "start"; sessionId: string; questionId: string; answerId: string }
  | { type: "searching"; queries: string[] }
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "done"; timings: Timings }
  | { type: "error"; message: string };

export type Timings = { firstTokenMs: number | null; totalMs: number };
