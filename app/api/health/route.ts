import { getDb, sqliteInfo } from "@/adapters/db";
import { ConfigError, loadConfig } from "@/config";
import type { Health } from "@/shared/dto";

export function GET(): Response {
  const body: Health = { missingEnv: missingEnv(), sqlite: sqliteInfo(getDb()) };
  return Response.json(body);
}

function missingEnv(): string[] {
  try {
    loadConfig();
    return [];
  } catch (error) {
    if (error instanceof ConfigError) return error.missing;
    throw error;
  }
}
