"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/(app)/admin/require-admin";
import { friendlyPrismaError, parseOrThrow } from "@/app/(app)/admin/prisma-error";
import { PERMISSION_FEATURES, PERMISSION_ROLES } from "@/app/(app)/admin/permissions/permission-types";

const FEATURE_KEYS = PERMISSION_FEATURES.map((f) => f.key) as [string, ...string[]];
const ROLE_VALUES = [...PERMISSION_ROLES] as [string, ...string[]];

const rowSchema = z.object({
  feature: z.enum(FEATURE_KEYS),
  role: z.enum(ROLE_VALUES),
  canCreate: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
  canReport: z.boolean(),
});

// Nhận nguyên cả N dòng (N tính năng x 3 vai trò — mỗi tính năng khớp 1 mục
// nav) mỗi lần bấm "Cập nhật quyền" — dữ liệu nhỏ, upsert cả lô trong 1
// transaction đơn giản hơn phải tính diff() những dòng nào thực sự đổi. Tăng
// timeout vì số dòng đã tăng lên vài chục kể từ khi phân quyền phủ hết nav.
export async function updateFeaturePermissions(rows: z.infer<typeof rowSchema>[]) {
  await requireAdmin();
  const data = parseOrThrow(z.array(rowSchema), rows);

  await prisma
    .$transaction(
      data.map((row) =>
        prisma.featurePermission.upsert({
          where: { feature_role: { feature: row.feature, role: row.role } },
          create: row,
          update: {
            canCreate: row.canCreate,
            canEdit: row.canEdit,
            canDelete: row.canDelete,
            canReport: row.canReport,
          },
        })
      ),
      { timeout: 30_000 }
    )
    .catch((err) => friendlyPrismaError(err, "Không cập nhật được phân quyền."));

  revalidatePath("/admin/permissions");
}
