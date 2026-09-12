import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { reassignInteraction } from "@/lib/interactions/mutations";
import { reassignSchema } from "@/lib/interactions/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = reassignSchema.parse(await request.json());
    const detail = await reassignInteraction(actor, id, body.targetEmail, body.reason, body.expectedVersion);
    return Response.json(detail);
  } catch (err) {
    return errorResponse(err);
  }
}
