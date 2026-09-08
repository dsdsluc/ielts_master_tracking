"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/(app)/admin/require-admin";
import { friendlyPrismaError } from "@/app/(app)/admin/prisma-error";

const sourceSchema = z.object({
  channelGroup: z.string().trim().min(1, "Vui lòng nhập nhóm kênh."),
  sourceGroup: z.string().trim().min(1, "Vui lòng nhập nhóm nguồn."),
  requireAdId: z.boolean(),
  note: z.string().trim().optional(),
});

export async function createSource(input: { name: string } & z.infer<typeof sourceSchema>) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Vui lòng nhập tên nguồn.");
  const data = sourceSchema.parse(input);

  const existing = await prisma.source.findUnique({ where: { name } });
  if (existing) throw new Error("Đã có nguồn với tên này.");

  await prisma.source.create({ data: { name, ...data, note: data.note || null } }).catch((err) => friendlyPrismaError(err, "Không tạo được nguồn."));
  revalidatePath("/admin/sources");
  revalidatePath("/leads");
}

export async function updateSource(name: string, input: z.infer<typeof sourceSchema>) {
  await requireAdmin();
  const data = sourceSchema.parse(input);
  await prisma.source
    .update({ where: { name }, data: { ...data, note: data.note || null } })
    .catch((err) => friendlyPrismaError(err, "Không cập nhật được nguồn."));
  revalidatePath("/admin/sources");
  revalidatePath("/leads");
}

export async function setSourceActive(name: string, active: boolean) {
  await requireAdmin();
  await prisma.source.update({ where: { name }, data: { active } }).catch((err) => friendlyPrismaError(err, "Không cập nhật được trạng thái."));
  revalidatePath("/admin/sources");
  revalidatePath("/leads");
}

function cleanDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export async function addSourceDomain(sourceName: string, domain: string) {
  await requireAdmin();
  const cleaned = cleanDomain(domain);
  if (!cleaned || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned)) {
    throw new Error("Domain không hợp lệ. Ví dụ hợp lệ: facebook.com");
  }
  await prisma.sourceDomain
    .upsert({
      where: { sourceName_domain: { sourceName, domain: cleaned } },
      update: {},
      create: { sourceName, domain: cleaned },
    })
    .catch((err) => friendlyPrismaError(err, "Không thêm được domain."));
  revalidatePath("/admin/sources");
  revalidatePath("/leads");
}

export async function removeSourceDomain(id: number) {
  await requireAdmin();
  await prisma.sourceDomain.delete({ where: { id } }).catch((err) => friendlyPrismaError(err, "Không xoá được domain."));
  revalidatePath("/admin/sources");
  revalidatePath("/leads");
}
