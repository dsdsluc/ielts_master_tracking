import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { getCustomersForSale, getSaleWorkloads } from "@/lib/customers/queries";
import { WorkloadBalanceView } from "@/app/(app)/customer-assignment/workload/workload-balance-view";

// Không có mục nav riêng — mirror /customer-assignment (chỉ vào được qua nút
// bấm ở Dashboard Leader), nhưng vẫn đăng ký trong PERMISSION_FEATURES để
// chặn bằng phân quyền thật thay vì chỉ ẩn/hiện đường link. Các mutation gọi
// từ trang này (assignCustomers/transferCustomers/reclaimCustomers) vẫn tự
// kiểm tra isLeaderLike() ở tầng dữ liệu — gate ở đây chỉ quyết định AI ĐƯỢC
// XEM trang, không thay cho lớp bảo vệ đó.
export default async function WorkloadBalancePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const actor = await getCurrentUser();
  await requireFeatureAccess(actor, "customerAssignmentWorkload");

  const { from } = await searchParams;
  const [workloads, customers] = await Promise.all([getSaleWorkloads(), from ? getCustomersForSale(from) : Promise.resolve(null)]);

  return (
    <>
      <PageHeader
        eyebrow="Leader"
        title="Cân bằng khối lượng công việc"
        description="Xem Sale nào đang quá tải hay quá rảnh, rồi điều chuyển khách hàng thẳng sang Sale khác trong 1 bước — kể cả khi Sale đã nghỉ việc/khoá tài khoản."
      />
      <WorkloadBalanceView workloads={workloads} selectedFrom={from ?? null} customers={customers} />
    </>
  );
}
