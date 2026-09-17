import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { restoreSpamToFollowup } from "@/lib/interactions/mutations";

const restoreSpamSchema = z.object({
  interactionIds: z.array(z.string()).min(1, "Vui lòng chọn ít nhất 1 liên hệ.").max(50, "Chỉ xử lý tối đa 50 liên hệ mỗi lần."),
  note: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = restoreSpamSchema.parse(await request.json());
    const result = await restoreSpamToFollowup(actor, body.interactionIds, body.note);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
