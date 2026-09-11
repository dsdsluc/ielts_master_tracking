import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { sendBroadcastEmail } from "@/lib/interactions/broadcast-email";

const schema = z.object({
  subject: z.string().trim().min(1, "Vui lòng nhập tiêu đề."),
  body: z.string().trim().min(1, "Vui lòng nhập nội dung."),
  recipientEmails: z
    .array(z.string().email("Email người nhận không hợp lệ."))
    .min(1, "Vui lòng chọn ít nhất 1 người nhận."),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = schema.parse(await request.json());
    const result = await sendBroadcastEmail(actor, body);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
