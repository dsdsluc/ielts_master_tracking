import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { getQueue } from "@/lib/interactions/queries";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const queue = await getQueue(actor);
    return Response.json(queue);
  } catch (err) {
    return errorResponse(err);
  }
}
