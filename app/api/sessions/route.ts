import { getStore } from "@/server/services";
import { getUserId } from "@/server/user";

export async function GET(): Promise<Response> {
  return Response.json(getStore().listSessions(await getUserId()));
}
