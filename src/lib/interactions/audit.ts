import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { newLogId } from "@/lib/interactions/ids";
import type { CurrentUser } from "@/lib/auth/dal";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Ghi 1 dòng SYSTEM_LOG — port logAction_(). */
export async function logAction(
  tx: Tx,
  actor: CurrentUser,
  action: string,
  interactionId: string | null,
  detailOld: unknown,
  detailNew: unknown,
  result: "SUCCESS" | "FAIL" = "SUCCESS",
  technicalInfo?: string
) {
  await tx.systemLog.create({
    data: {
      logId: newLogId(),
      loggedAt: new Date(),
      actorEmail: actor.email,
      actorName: actor.fullName,
      actorRole: actor.role,
      action,
      interactionId: interactionId ?? undefined,
      detailOld: (detailOld ?? undefined) as Prisma.InputJsonValue,
      detailNew: (detailNew ?? undefined) as Prisma.InputJsonValue,
      result,
      technicalInfo,
    },
  });
}
