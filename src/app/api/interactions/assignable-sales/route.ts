import { requireApiUser } from "@/lib/auth/api";
import { Errors, errorResponse } from "@/lib/interactions/errors";
import { CAN_REASSIGN } from "@/lib/interactions/constants";
import { getAssignableSalesForReassign } from "@/lib/interactions/queries";

export async function GET() {
  try {
    const actor = await requireApiUser();
    if (!(CAN_REASSIGN as readonly string[]).includes(actor.role)) {
      throw Errors.forbidden("Bạn không có quyền điều chuyển người phụ trách.");
    }
    const sales = await getAssignableSalesForReassign();
    return Response.json(sales);
  } catch (err) {
    return errorResponse(err);
  }
}
