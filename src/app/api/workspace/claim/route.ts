import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { claimManyForWorkspace } from "@/lib/interactions/workspace";

const schema = z.object({
  interactionIds: z.array(z.string().min(1, "Mã liên hệ không hợp lệ.")).min(1, "Vui lòng chọn ít nhất 1 liên hệ."),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = schema.parse(await request.json());
    const result = await claimManyForWorkspace(actor, body.interactionIds);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
