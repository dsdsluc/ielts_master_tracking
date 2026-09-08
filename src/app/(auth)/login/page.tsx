import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { LoginForm } from "@/app/(auth)/login/login-form";

export default async function LoginPage() {
  const session = await readSession();
  if (session) {
    redirect("/");
  }

  return <LoginForm />;
}
