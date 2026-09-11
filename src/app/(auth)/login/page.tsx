import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { LoginForm } from "@/app/(auth)/login/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const session = await readSession();
  if (session) {
    redirect("/");
  }

  const { reason } = await searchParams;
  return <LoginForm sessionExpired={reason === "session-expired"} />;
}
