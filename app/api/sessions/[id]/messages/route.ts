import { getStore } from "@/server/services";
import { getUserId } from "@/server/user";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/sessions/[id]/messages">,
): Promise<Response> {
  const { id } = await params;
  return Response.json(getStore().messages(await getUserId(), id));
}
