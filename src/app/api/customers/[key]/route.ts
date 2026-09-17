import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { getCustomerDetail } from "@/lib/customers/queries";
import { updateCustomerProfile } from "@/lib/customers/mutations";
import { customerProfileSchema } from "@/lib/customers/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const actor = await requireApiUser();
    const { key } = await params;
    const customer = await getCustomerDetail(actor, key);
    return Response.json(customer);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const actor = await requireApiUser();
    const { key } = await params;
    const body = customerProfileSchema.parse(await request.json());
    const customer = await updateCustomerProfile(actor, key, body);
    return Response.json(customer);
  } catch (err) {
    return errorResponse(err);
  }
}
