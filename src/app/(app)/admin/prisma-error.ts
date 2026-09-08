import { Prisma } from "@/generated/prisma/client";

/** Chuyển lỗi Prisma (unique/FK) thành thông báo tiếng Việt dễ hiểu cho form admin. */
export function friendlyPrismaError(err: unknown, fallback: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") throw new Error("Đã tồn tại bản ghi với giá trị này.");
    if (err.code === "P2003") throw new Error("Giá trị tham chiếu không hợp lệ (nguồn/cơ sở không tồn tại hoặc đã bị xoá).");
    if (err.code === "P2025") throw new Error("Không tìm thấy bản ghi để cập nhật.");
  }
  if (err instanceof Error) throw err;
  throw new Error(fallback);
}
