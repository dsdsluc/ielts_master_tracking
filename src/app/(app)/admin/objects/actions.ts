"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/(app)/admin/require-admin";
import { friendlyPrismaError } from "@/app/(app)/admin/prisma-error";

const objectSchema = z.object({
  sortOrder: z.coerce.number().int().min(0, "Thứ tự phải >= 0."),
});

export async function createObject(input: { name: string } & z.input<typeof objectSchema>) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Vui lòng nhập tên đối tượng.");
  const data = objectSchema.parse(input);

  const existing = await prisma.customerObject.findUnique({ where: { name } });
  if (existing) throw new Error("Đã có đối tượng với tên này.");

  await prisma.customerObject.create({ data: { name, ...data } }).catch((err) => friendlyPrismaError(err, "Không tạo được đối tượng."));
  revalidatePath("/admin/objects");
  revalidatePath("/leads");
}

export async function updateObject(name: string, input: z.input<typeof objectSchema>) {
  await requireAdmin();
  const data = objectSchema.parse(input);
  await prisma.customerObject.update({ where: { name }, data }).catch((err) => friendlyPrismaError(err, "Không cập nhật được đối tượng."));
  revalidatePath("/admin/objects");
  revalidatePath("/leads");
}

export async function setObjectActive(name: string, active: boolean) {
  await requireAdmin();
  await prisma.customerObject.update({ where: { name }, data: { active } }).catch((err) => friendlyPrismaError(err, "Không cập nhật được trạng thái."));
  revalidatePath("/admin/objects");
  revalidatePath("/leads");
}
