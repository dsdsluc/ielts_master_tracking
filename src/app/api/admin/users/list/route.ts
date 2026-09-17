import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireApiUser();

    const users = await prisma.user.findMany({
      where: { active: true },
      select: { email: true, fullName: true, role: true, branch: { select: { name: true } } },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    });

    return Response.json({
      users: users.map((u) => ({ email: u.email, fullName: u.fullName, role: u.role, branchName: u.branch?.name ?? null })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
