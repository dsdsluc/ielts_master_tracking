import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { assignCustomers } from "@/lib/customers/mutations";
import { assignCustomersSchema } from "@/lib/customers/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = assignCustomersSchema.parse(await request.json());
    const result = await assignCustomers(actor, body.customerKeys, body.targetEmail);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
