import { getCurrentUser } from "@/lib/auth/dal";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await getCurrentUser();
  return children;
}
