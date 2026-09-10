import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { flagSlaBreaches } from "@/lib/interactions/sla";

const schema = z.object({
  interactionIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = schema.parse(await request.json());
    const flaggedCount = await flagSlaBreaches(actor, body.interactionIds);
    return Response.json({ flaggedCount });
  } catch (err) {
    return errorResponse(err);
  }
}
