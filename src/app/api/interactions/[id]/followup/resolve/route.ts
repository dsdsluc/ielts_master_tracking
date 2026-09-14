import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { resolveFollowup } from "@/lib/interactions/mutations";

const resolveFollowupSchema = z.object({
  note: z.string().trim().min(1, "Vui lòng ghi lại đã xử lý như thế nào.").max(2000, "Ghi chú quá dài."),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = resolveFollowupSchema.parse(await request.json());
    const detail = await resolveFollowup(actor, id, body.note);
    return Response.json(detail);
  } catch (err) {
    return errorResponse(err);
  }
}
