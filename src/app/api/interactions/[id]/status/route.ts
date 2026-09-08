import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { updateStatus } from "@/lib/interactions/mutations";
import { statusUpdateSchema } from "@/lib/interactions/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = statusUpdateSchema.parse(await request.json());
    const detail = await updateStatus(actor, id, body);
    return Response.json(detail);
  } catch (err) {
    return errorResponse(err);
  }
}
