import { requireApiUser } from "@/lib/auth/api";
import { Errors, errorResponse } from "@/lib/interactions/errors";
import { CAN_PUSH_FOLLOWUP, CAN_REASSIGN } from "@/lib/interactions/constants";
import { getAssignableSalesForReassign } from "@/lib/interactions/queries";

// Dùng chung cho 2 tính năng: điều chuyển người phụ trách (CAN_REASSIGN) và
// chọn Sale nhận yêu cầu chăm sóc lại (CAN_PUSH_FOLLOWUP, có thêm Marketing).
export async function GET() {
  try {
    const actor = await requireApiUser();
    const allowed = (CAN_REASSIGN as readonly string[]).includes(actor.role) || (CAN_PUSH_FOLLOWUP as readonly string[]).includes(actor.role);
    if (!allowed) {
      throw Errors.forbidden("Bạn không có quyền xem danh sách tư vấn viên này.");
    }
    const sales = await getAssignableSalesForReassign();
    return Response.json(sales);
  } catch (err) {
    return errorResponse(err);
  }
}
