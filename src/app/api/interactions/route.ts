import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { ApiError, errorResponse } from "@/lib/interactions/errors";
import { listInteractions } from "@/lib/interactions/queries";
import { createInteraction } from "@/lib/interactions/mutations";
import { leadInfoSchema, listInteractionsQuerySchema } from "@/lib/interactions/validation";
import { buildDuplicateConflictResponse, type DuplicateInfo } from "@/lib/interactions/duplicate";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireApiUser();
    const query = listInteractionsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));

    const result = await listInteractions(actor, {
      status: query.status,
      needsFollowup: query.needsFollowup === "true",
      mine: query.mine === "true",
      branch: query.branch,
      search: query.search,
      page: query.page,
      pageSize: query.pageSize,
    });

    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireApiUser();
    const body = leadInfoSchema.parse(await request.json());

    const { lead } = await createInteraction(actor, body);
    return Response.json({ interactionId: lead.interactionId }, { status: 201 });
  } catch (err) {
    if (err instanceof ApiError && err.code === "DUPLICATE_CONFIRM_REQUIRED") {
      return Response.json(await buildDuplicateConflictResponse(err.data as DuplicateInfo), { status: 409 });
    }
    return errorResponse(err);
  }
}
