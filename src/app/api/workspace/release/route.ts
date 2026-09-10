import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { releaseFromWorkspace } from "@/lib/interactions/workspace";

const schema = z.object({
  interactionId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser();
    const body = schema.parse(await request.json());
    await releaseFromWorkspace(actor, body.interactionId);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
