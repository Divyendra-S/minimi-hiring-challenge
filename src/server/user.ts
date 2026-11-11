import { cookies } from "next/headers";

const COOKIE = "uid";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

/** There are no accounts: each browser gets a random id, and all data is scoped to it. */
export async function getUserId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;
  const id = crypto.randomUUID();
  jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: ONE_YEAR_S });
  return id;
}
