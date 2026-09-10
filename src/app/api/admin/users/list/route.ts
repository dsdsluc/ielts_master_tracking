import { requireApiUser } from "@/lib/auth/api";
import { errorResponse, ApiError } from "@/lib/interactions/errors";
import { ROLES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const actor = await requireApiUser();
    if (actor.role !== ROLES.ADMIN) {
      throw new ApiError(403, "FORBIDDEN", "Chỉ Quản trị hệ thống được xem danh sách này.");
    }

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
