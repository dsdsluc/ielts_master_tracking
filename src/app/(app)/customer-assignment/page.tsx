import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { getAssignableCustomers } from "@/lib/customers/queries";
import { getAssignableSalesForReassign } from "@/lib/interactions/queries";
import { AssignableCustomersView } from "@/app/(app)/customer-assignment/assignable-customers-view";

export default async function CustomerAssignmentPage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "customerAssignment");

  const [customers, sales] = await Promise.all([getAssignableCustomers(), getAssignableSalesForReassign()]);

  return (
    <>
      <PageHeader
        eyebrow="Leader"
        title="Phân bổ khách hàng"
        description="Chọn khách hàng đã Đủ tiêu chuẩn (có SĐT) để phân bổ cho 1 Sale gọi điện tư vấn ghi danh."
      />
      <AssignableCustomersView customers={customers} sales={sales} />
    </>
  );
}
