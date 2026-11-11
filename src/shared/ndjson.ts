/** Newline-delimited JSON: one JSON value per line, so a stream can be parsed as it arrives. */
export function encodeLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export async function* readLines<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }); // stream: a character may span chunks
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // the last piece may be an incomplete line
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as T;
  }
}
