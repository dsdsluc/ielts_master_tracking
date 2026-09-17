import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { listOpenInteractions } from "@/lib/interactions/queries";

export async function GET() {
  try {
    const actor = await requireApiUser();
    return Response.json({ items: await listOpenInteractions(actor) });
  } catch (err) {
    return errorResponse(err);
  }
}
