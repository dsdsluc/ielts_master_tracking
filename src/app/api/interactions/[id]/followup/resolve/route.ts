import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { resolveFollowup } from "@/lib/interactions/mutations";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const detail = await resolveFollowup(actor, id);
    return Response.json(detail);
  } catch (err) {
    return errorResponse(err);
  }
}
