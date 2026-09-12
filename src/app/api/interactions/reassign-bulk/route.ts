import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { reassignInteractions } from "@/lib/interactions/mutations";
import { bulkReassignSchema } from "@/lib/interactions/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = bulkReassignSchema.parse(await request.json());
    const result = await reassignInteractions(actor, body.items, body.targetEmail, body.reason);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
