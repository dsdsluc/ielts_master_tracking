"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/(app)/admin/require-admin";
import { friendlyPrismaError, parseOrThrow } from "@/app/(app)/admin/prisma-error";

// Chỉ cho sửa sortOrder/note — 4 tên trạng thái (Chờ/Tiếp nhận/Đủ tiêu chuẩn/
// Spam) được hardcode trong lib/interactions/constants.ts và toàn bộ luồng
// nghiệp vụ (mutations.ts, queries.ts), KHÔNG đọc từ bảng này. Thêm/xoá/đổi
// tên trạng thái ở đây sẽ không có tác dụng gì với hệ thống — tránh làm UI
// gây hiểu lầm là có thể mở rộng tự do.
const statusMetaSchema = z.object({
  sortOrder: z.coerce.number().int().min(0, "Thứ tự phải >= 0."),
  note: z.string().trim().optional(),
});

export async function updateStatusMeta(name: string, input: z.input<typeof statusMetaSchema>) {
  await requireAdmin();
  const data = parseOrThrow(statusMetaSchema, input);
  await prisma.status
    .update({ where: { name }, data: { sortOrder: data.sortOrder, note: data.note || null } })
    .catch((err) => friendlyPrismaError(err, "Không cập nhật được trạng thái."));
  revalidatePath("/admin/statuses");
}
