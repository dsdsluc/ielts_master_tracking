import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { logCustomerCare } from "@/lib/customers/mutations";
import { customerCareLogSchema } from "@/lib/customers/validation";

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const actor = await requireApiUser();
    const { key } = await params;
    const body = customerCareLogSchema.parse(await request.json());
    const customer = await logCustomerCare(actor, key, body.content);
    return Response.json(customer);
  } catch (err) {
    return errorResponse(err);
  }
}
