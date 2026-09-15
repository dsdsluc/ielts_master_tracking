import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { pushFollowup } from "@/lib/interactions/mutations";

const pushFollowupSchema = z.object({
  interactionIds: z.array(z.string()).min(1, "Vui lòng chọn ít nhất 1 liên hệ.").max(50, "Chỉ gửi tối đa 50 liên hệ mỗi lần."),
  suggestion: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = pushFollowupSchema.parse(await request.json());
    const result = await pushFollowup(actor, body.interactionIds, body.suggestion);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
