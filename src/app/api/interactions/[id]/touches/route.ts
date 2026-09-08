import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { recordTouch } from "@/lib/interactions/mutations";
import { touchSchema } from "@/lib/interactions/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = touchSchema.parse(await request.json().catch(() => ({})));
    const detail = await recordTouch(actor, id, body.note);
    return Response.json(detail);
  } catch (err) {
    return errorResponse(err);
  }
}
