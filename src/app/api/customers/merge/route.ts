import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { mergeCustomers } from "@/lib/customers/merge";

const schema = z.object({
  keepCustomerKey: z.string().min(1, "Vui lòng chọn khách hàng giữ lại."),
  removeCustomerKeys: z.array(z.string()).min(1, "Vui lòng chọn ít nhất 1 khách hàng để gộp."),
  displayName: z.string().trim().min(1, "Vui lòng nhập tên khách hàng."),
  phoneNormalized: z.string().trim().optional(),
  canonicalLink: z.string().trim().min(1, "Vui lòng nhập Link chuẩn."),
  currentStatusName: z.string().trim().min(1, "Vui lòng chọn trạng thái."),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = schema.parse(await request.json());
    const result = await mergeCustomers(actor, body.keepCustomerKey, body.removeCustomerKeys, {
      displayName: body.displayName,
      phoneNormalized: body.phoneNormalized || null,
      canonicalLink: body.canonicalLink,
      currentStatusName: body.currentStatusName,
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
