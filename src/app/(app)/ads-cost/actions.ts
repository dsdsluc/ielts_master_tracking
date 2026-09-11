"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { friendlyPrismaError, parseOrThrow } from "@/app/(app)/admin/prisma-error";

/** Chặn Server Action nếu người gọi không phải Marketing/Admin — trang có thể
 * ẩn nav với vai trò khác, nhưng action ghi dữ liệu vẫn phải tự kiểm tra. */
async function requireAdsCostAccess() {
  const user = await getCurrentUser();
  if (user.role !== ROLES.MARKETING && user.role !== ROLES.ADMIN) {
    throw new Error("Chỉ Marketing hoặc Quản trị hệ thống được thực hiện chức năng này.");
  }
  return user;
}

const NONE = "none";

const adsCostSchema = z
  .object({
    periodStart: z.string().min(1, "Vui lòng chọn ngày bắt đầu."),
    periodEnd: z.string().min(1, "Vui lòng chọn ngày kết thúc."),
    adId: z.string().trim().min(1, "Vui lòng nhập Ad ID."),
    adName: z.string().trim().min(1, "Vui lòng nhập tên quảng cáo."),
    sourceName: z.string().optional(),
    fanpageName: z.string().optional(),
    branchCode: z.string().optional(),
    costVnd: z.coerce.number().min(0, "Chi phí phải >= 0."),
    note: z.string().trim().optional(),
  })
  .refine((data) => new Date(data.periodEnd) >= new Date(data.periodStart), {
    message: "Ngày kết thúc phải sau ngày bắt đầu.",
    path: ["periodEnd"],
  });

type AdsCostInput = z.input<typeof adsCostSchema>;

function toWriteData(data: z.output<typeof adsCostSchema>, updatedByEmail: string) {
  return {
    periodStart: new Date(data.periodStart),
    periodEnd: new Date(data.periodEnd),
    adId: data.adId,
    adName: data.adName,
    sourceName: !data.sourceName || data.sourceName === NONE ? null : data.sourceName,
    fanpageName: !data.fanpageName || data.fanpageName === NONE ? null : data.fanpageName,
    branchCode: !data.branchCode || data.branchCode === NONE ? null : data.branchCode,
    costVnd: data.costVnd,
    note: data.note || null,
    updatedByEmail,
    updatedAt: new Date(),
  };
}

export async function createAdsCost(input: AdsCostInput) {
  const user = await requireAdsCostAccess();
  const data = parseOrThrow(adsCostSchema, input);
  await prisma.adsCost
    .create({ data: toWriteData(data, user.email) })
    .catch((err) => friendlyPrismaError(err, "Không tạo được chi phí quảng cáo."));
  revalidatePath("/ads-cost");
}

export async function updateAdsCost(id: number, input: AdsCostInput) {
  const user = await requireAdsCostAccess();
  const data = parseOrThrow(adsCostSchema, input);
  await prisma.adsCost
    .update({ where: { id }, data: toWriteData(data, user.email) })
    .catch((err) => friendlyPrismaError(err, "Không cập nhật được chi phí quảng cáo."));
  revalidatePath("/ads-cost");
}

export async function deleteAdsCost(id: number) {
  await requireAdsCostAccess();
  await prisma.adsCost
    .delete({ where: { id } })
    .catch((err) => friendlyPrismaError(err, "Không xoá được chi phí quảng cáo."));
  revalidatePath("/ads-cost");
}
