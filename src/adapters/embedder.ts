import { pipeline } from "@huggingface/transformers";

// A small sentence-embedding model that runs in this process: no key, no network call per turn,
// about 2 ms per sentence. Its 23 MB of weights are downloaded once, on first use.
const MODEL = "Xenova/all-MiniLM-L6-v2";

export type Embedder = {
  /** One unit-length vector per text. Waits for the model to load; for background work. */
  embed(texts: string[]): Promise<Float32Array[]>;
  /** For the reply path: undefined at once if the model is still loading or failed to load. */
  embedIfReady(text: string): Promise<Float32Array | undefined>;
};

/** Starts loading the model right away. */
export function localEmbedder(): Embedder {
  let ready = false;
  const model = pipeline("feature-extraction", MODEL, { dtype: "q8" }).then((extractor) => {
    ready = true;
    return extractor;
  });
  model.catch((error) =>
    console.error("Embedding model failed to load; recall uses keywords only:", error),
  );

  async function embed(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    const output = await (await model)(texts, { pooling: "mean", normalize: true });
    const [count = 0, size = 0] = output.dims;
    const data = output.data as Float32Array;
    return Array.from({ length: count }, (_, i) => data.slice(i * size, (i + 1) * size));
  }
  return {
    embed,
    async embedIfReady(text) {
      return ready ? (await embed([text]))[0] : undefined;
    },
  };
}
