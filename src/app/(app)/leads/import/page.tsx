import { PageHeader } from "@/components/page-header";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { ROLES } from "@/lib/interactions/constants";
import { getLeadFormOptions } from "@/app/(app)/leads/get-lead-form-options";
import { LeadsImportView } from "@/app/(app)/leads/import/leads-import-view";

export default async function LeadsImportPage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user.role, "leadsImport");
  const options = await getLeadFormOptions();

  // Sale luôn bị khoá đúng 1 cơ sở (theo quy tắc requireValidSaleBranchScope) —
  // cả file import dùng chung cơ sở đó, không cần chọn theo từng dòng. Leader/Admin
  // không bị khoá cơ sở nên cho chọn 1 cơ sở áp dụng cho cả file.
  const branchLocked = user.role === ROLES.SALES;
  const lockedBranchName = options.branches.find((b) => b.code === user.branchCode)?.name ?? user.branchCode;

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Nhập liên hệ từ Excel"
        description="Tải file Excel danh sách khách hàng, kiểm tra/chỉnh sửa từng dòng trước khi lưu vào hệ thống."
      />
      <LeadsImportView
        options={options}
        branchLocked={branchLocked}
        lockedBranchCode={user.branchCode}
        lockedBranchName={lockedBranchName}
      />
    </>
  );
}
