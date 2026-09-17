import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { getAssignableSalesForReassign } from "@/lib/interactions/queries";

// Dùng chung cho 2 tính năng: điều chuyển người phụ trách và chọn Sale nhận
// yêu cầu chăm sóc lại.
export async function GET() {
  try {
    await requireApiUser();
    const sales = await getAssignableSalesForReassign();
    return Response.json(sales);
  } catch (err) {
    return errorResponse(err);
  }
}
