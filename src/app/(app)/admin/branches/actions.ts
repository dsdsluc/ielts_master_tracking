"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/(app)/admin/require-admin";
import { friendlyPrismaError } from "@/app/(app)/admin/prisma-error";

const branchSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên cơ sở."),
  slaReceiveMinutes: z.coerce.number().int().min(1, "SLA nhận phải >= 1 phút."),
  slaProcessHours: z.coerce.number().int().min(1, "SLA xử lý phải >= 1 giờ."),
  note: z.string().trim().optional(),
});

export async function createBranch(input: { code: string } & z.input<typeof branchSchema>) {
  await requireAdmin();
  const code = input.code.trim();
  if (!code) throw new Error("Vui lòng nhập mã cơ sở.");
  const data = branchSchema.parse(input);

  const existing = await prisma.branch.findUnique({ where: { code } });
  if (existing) throw new Error("Đã có cơ sở với mã này.");

  await prisma.branch
    .create({ data: { code, ...data, note: data.note || null } })
    .catch((err) => friendlyPrismaError(err, "Không tạo được cơ sở."));
  revalidatePath("/admin/branches");
  revalidatePath("/leads");
}

export async function updateBranch(code: string, input: z.input<typeof branchSchema>) {
  await requireAdmin();
  const data = branchSchema.parse(input);
  await prisma.branch
    .update({ where: { code }, data: { ...data, note: data.note || null } })
    .catch((err) => friendlyPrismaError(err, "Không cập nhật được cơ sở."));
  revalidatePath("/admin/branches");
  revalidatePath("/leads");
}

export async function setBranchActive(code: string, active: boolean) {
  await requireAdmin();
  await prisma.branch.update({ where: { code }, data: { active } }).catch((err) => friendlyPrismaError(err, "Không cập nhật được trạng thái."));
  revalidatePath("/admin/branches");
  revalidatePath("/leads");
}
