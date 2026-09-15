import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { assignFollowup } from "@/lib/interactions/mutations";

const assignFollowupSchema = z.object({
  interactionIds: z.array(z.string()).min(1, "Vui lòng chọn ít nhất 1 liên hệ.").max(50, "Chỉ phân bổ tối đa 50 liên hệ mỗi lần."),
  targetSaleEmail: z.string().trim().email("Vui lòng chọn Sale phụ trách."),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = assignFollowupSchema.parse(await request.json());
    const result = await assignFollowup(actor, body.interactionIds, body.targetSaleEmail);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
