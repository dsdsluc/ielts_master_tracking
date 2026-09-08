import { requireRole } from "@/lib/auth/dal";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireRole("Quản trị hệ thống");
  return children;
}
