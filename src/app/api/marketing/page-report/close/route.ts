import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { closePageReport } from "@/lib/marketing/page-report";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ."),
  fanpageName: z.string().trim().min(1, "Vui lòng chọn fanpage."),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = schema.parse(await request.json());
    const result = await closePageReport(actor, body.date, body.fanpageName);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
