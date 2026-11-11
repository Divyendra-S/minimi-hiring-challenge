import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeLine, readLines } from "@/shared/ndjson";

test("lines split across chunks, even inside a multi-byte character, decode intact", async () => {
  const bytes = new TextEncoder().encode(encodeLine({ text: "café ☕" }) + encodeLine({ n: 2 }));
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); // one byte per chunk
      controller.close();
    },
  });
  const values: unknown[] = [];
  for await (const value of readLines(body)) values.push(value);
  assert.deepEqual(values, [{ text: "café ☕" }, { n: 2 }]);
});
