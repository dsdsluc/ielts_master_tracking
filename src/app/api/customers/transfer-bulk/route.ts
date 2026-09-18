import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { transferCustomers } from "@/lib/customers/mutations";
import { transferCustomersSchema } from "@/lib/customers/validation";

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = transferCustomersSchema.parse(await request.json());
    const result = await transferCustomers(actor, body.customerKeys, body.targetEmail);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
