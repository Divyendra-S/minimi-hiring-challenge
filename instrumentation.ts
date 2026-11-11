/** Runs once when the server starts: load the embedding model before the first message needs it. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEmbedder } = await import("@/server/services");
  getEmbedder();
}
