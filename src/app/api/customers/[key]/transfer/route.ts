import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { transferCustomer } from "@/lib/customers/mutations";
import { transferCustomerSchema } from "@/lib/customers/validation";

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const actor = await requireApiUser();
    const { key } = await params;
    const body = transferCustomerSchema.parse(await request.json());
    const customer = await transferCustomer(actor, key, body.targetEmail);
    return Response.json(customer);
  } catch (err) {
    return errorResponse(err);
  }
}
