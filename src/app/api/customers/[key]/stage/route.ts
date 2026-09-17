import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { updateCustomerStage } from "@/lib/customers/mutations";
import { customerStageSchema } from "@/lib/customers/validation";

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const actor = await requireApiUser();
    const { key } = await params;
    const body = customerStageSchema.parse(await request.json());
    const customer = await updateCustomerStage(actor, key, body);
    return Response.json(customer);
  } catch (err) {
    return errorResponse(err);
  }
}
