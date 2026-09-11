"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/(app)/admin/require-admin";
import { friendlyPrismaError, parseOrThrow } from "@/app/(app)/admin/prisma-error";

const settingSchema = z.object({
  configGroup: z.string().trim().min(1, "Nhóm cấu hình không hợp lệ."),
  key: z.string().trim().min(1, "Khoá cấu hình không hợp lệ."),
  value: z.string().trim().min(1, "Vui lòng nhập giá trị."),
});

export async function upsertSetting(input: z.input<typeof settingSchema>) {
  await requireAdmin();
  const data = parseOrThrow(settingSchema, input);
  await prisma.appSetting
    .upsert({
      where: { configGroup_key: { configGroup: data.configGroup, key: data.key } },
      update: { value: data.value },
      create: data,
    })
    .catch((err) => friendlyPrismaError(err, "Không lưu được cấu hình."));
  revalidatePath("/admin/settings");
}
