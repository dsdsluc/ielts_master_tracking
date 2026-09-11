import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { deleteSystemLogs } from "@/lib/logs/cleanup";

const schema = z.object({
  logIds: z.array(z.string().min(1, "Mã nhật ký không hợp lệ.")).min(1, "Vui lòng chọn ít nhất 1 dòng."),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = schema.parse(await request.json());
    const deletedCount = await deleteSystemLogs(actor, body.logIds);
    return Response.json({ deletedCount });
  } catch (err) {
    return errorResponse(err);
  }
}
