"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { getHomePathForRole } from "@/lib/nav";

export type LoginState = { error?: string } | undefined;

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Vui lòng nhập email và mật khẩu." };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Không tiết lộ email có tồn tại hay không — cùng một thông báo lỗi.
  if (!user || !user.active) {
    return { error: "Email hoặc mật khẩu không đúng." };
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return { error: "Email hoặc mật khẩu không đúng." };
  }

  await createSession({
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    branchCode: user.branchCode,
    viewAllBranches: user.viewAllBranches,
  });

  redirect(getHomePathForRole(user.role));
}
