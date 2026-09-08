import { requireApiUser } from "@/lib/auth/api";
import { ApiError, errorResponse } from "@/lib/interactions/errors";
import { getInteractionDetail } from "@/lib/interactions/queries";
import { updateInteractionInfo } from "@/lib/interactions/mutations";
import { buildDuplicateConflictResponse, type DuplicateInfo } from "@/lib/interactions/duplicate";
import { updateLeadInfoSchema } from "@/lib/interactions/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const detail = await getInteractionDetail(actor, id);
    return Response.json(detail);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = updateLeadInfoSchema.parse(await request.json());

    const detail = await updateInteractionInfo(actor, id, body);
    return Response.json(detail);
  } catch (err) {
    if (err instanceof ApiError && err.code === "DUPLICATE_CONFIRM_REQUIRED") {
      return Response.json(await buildDuplicateConflictResponse(err.data as DuplicateInfo), { status: 409 });
    }
    return errorResponse(err);
  }
}
