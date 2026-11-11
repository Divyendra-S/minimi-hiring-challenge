import { z } from "zod";

const EnvSchema = z
  .object({
    OPENROUTER_API_KEY: z.string().min(1),
    TAVILY_API_KEY: z.string().min(1),
    CHAT_MODEL: z.string().min(1).default("openai/gpt-6-luna"),
    MEMORY_MODEL: z.string().min(1).default("openai/gpt-6-luna"),
    // Optional spending cap: dollars the app may spend, counted from the key's usage at the start.
    OPENROUTER_KEY_USAGE_CAP_USD: z.coerce.number().positive().optional(),
    OPENROUTER_KEY_USAGE_START_USD: z.coerce.number().nonnegative().optional(),
  })
  .refine(
    (env) =>
      env.OPENROUTER_KEY_USAGE_CAP_USD === undefined ||
      env.OPENROUTER_KEY_USAGE_START_USD !== undefined,
    { path: ["OPENROUTER_KEY_USAGE_START_USD"], message: "Required with a spending cap" },
  );

export type Config = z.infer<typeof EnvSchema>;

export class ConfigError extends Error {
  constructor(readonly missing: string[]) {
    super(
      `Missing or invalid environment variables: ${missing.join(", ")}. ` +
        "Copy .env.example to .env and fill them in.",
    );
  }
}

/** Validates the environment, reporting every bad variable at once instead of failing on the first. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((issue) => issue.path.join(".")));
  }
  return parsed.data;
}
