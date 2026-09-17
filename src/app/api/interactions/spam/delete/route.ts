import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { deleteSpamInteractions } from "@/lib/interactions/mutations";

const deleteSpamSchema = z.object({
  interactionIds: z.array(z.string()).min(1, "Vui lòng chọn ít nhất 1 liên hệ.").max(50, "Chỉ xoá tối đa 50 liên hệ mỗi lần."),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = deleteSpamSchema.parse(await request.json());
    const result = await deleteSpamInteractions(actor, body.interactionIds, body.reason);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
