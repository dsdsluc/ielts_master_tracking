import { ShieldX } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { getCurrentUser } from "@/lib/auth/dal";

export default async function AccessDeniedPage() {
  await getCurrentUser();

  return (
    <>
      <PageHeader eyebrow="Phân quyền" title="Không có quyền truy cập" />
      <EmptyState
        icon={ShieldX}
        title="Bạn không có quyền truy cập trang này"
        description="Liên hệ Admin để được cấp quyền ở trang Phân quyền nếu bạn cần dùng tính năng này."
      />
    </>
  );
}
