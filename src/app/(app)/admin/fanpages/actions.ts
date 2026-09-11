"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/(app)/admin/require-admin";
import { friendlyPrismaError, parseOrThrow } from "@/app/(app)/admin/prisma-error";

const fanpageSchema = z.object({
  defaultSourceName: z.string().trim().min(1, "Vui lòng chọn nguồn mặc định."),
  suggestedBranchCode: z.string().trim().min(1, "Vui lòng chọn cơ sở gợi ý."),
  requireAdId: z.boolean(),
  note: z.string().trim().optional(),
});

export async function createFanpage(input: { name: string } & z.infer<typeof fanpageSchema>) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Vui lòng nhập tên fanpage.");
  const data = parseOrThrow(fanpageSchema, input);

  const existing = await prisma.fanpage.findUnique({ where: { name } });
  if (existing) throw new Error("Đã có fanpage với tên này.");

  await prisma.fanpage
    .create({ data: { name, ...data, note: data.note || null } })
    .catch((err) => friendlyPrismaError(err, "Không tạo được fanpage."));
  revalidatePath("/admin/fanpages");
  revalidatePath("/leads");
}

export async function updateFanpage(name: string, input: z.infer<typeof fanpageSchema>) {
  await requireAdmin();
  const data = parseOrThrow(fanpageSchema, input);
  await prisma.fanpage
    .update({ where: { name }, data: { ...data, note: data.note || null } })
    .catch((err) => friendlyPrismaError(err, "Không cập nhật được fanpage."));
  revalidatePath("/admin/fanpages");
  revalidatePath("/leads");
}

export async function setFanpageActive(name: string, active: boolean) {
  await requireAdmin();
  await prisma.fanpage.update({ where: { name }, data: { active } }).catch((err) => friendlyPrismaError(err, "Không cập nhật được trạng thái."));
  revalidatePath("/admin/fanpages");
  revalidatePath("/leads");
}
