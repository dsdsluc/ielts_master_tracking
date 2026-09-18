import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { getPageReportLeadDetails } from "@/lib/marketing/page-report";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ."),
  fanpageName: z.string().trim().min(1, "Vui lòng chọn fanpage."),
});

export async function GET(request: Request) {
  try {
    await requireApiUser();
    const url = new URL(request.url);
    const body = schema.parse({ date: url.searchParams.get("date") ?? "", fanpageName: url.searchParams.get("fanpageName") ?? "" });
    const rows = await getPageReportLeadDetails(body.date, body.fanpageName);
    return Response.json({ rows });
  } catch (err) {
    return errorResponse(err);
  }
}
