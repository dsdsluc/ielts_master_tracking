import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { deleteAdsCostRows } from "@/lib/ads-cost/cleanup";

const schema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "Vui lòng chọn ít nhất 1 dòng."),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = schema.parse(await request.json());
    const deletedCount = await deleteAdsCostRows(actor, body.ids);
    return Response.json({ deletedCount });
  } catch (err) {
    return errorResponse(err);
  }
}
