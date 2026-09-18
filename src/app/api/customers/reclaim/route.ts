import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { reclaimCustomers } from "@/lib/customers/mutations";
import { reclaimCustomersSchema } from "@/lib/customers/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = reclaimCustomersSchema.parse(await request.json());
    const result = await reclaimCustomers(actor, body.customerKeys);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
