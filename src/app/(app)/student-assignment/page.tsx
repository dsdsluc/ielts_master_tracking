import Link from "next/link";
import { ChartColumn, UserRoundPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";
import { CAN_REASSIGN } from "@/lib/interactions/constants";
import { getAssignableLeads, getAssignableSales } from "@/lib/students/queries";
import { AssignableLeadsTable } from "@/app/(app)/student-assignment/assignable-leads-table";

export default async function StudentAssignmentPage() {
  const actor = await requireRole(...CAN_REASSIGN);
  const [leads, sales] = await Promise.all([getAssignableLeads(actor), getAssignableSales(actor)]);

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Phân bổ học viên"
        description='Chọn liên hệ đã "Đủ tiêu chuẩn" (có SĐT) để phân bổ cho 1 Sale gọi điện tư vấn ghi danh.'
        action={
          <Button type="button" variant="outline" nativeButton={false} className="rounded-full" render={<Link href="/student-assignment/stats" />}>
            <ChartColumn className="size-4" />
            Xem thống kê
          </Button>
        }
      />

      {leads.length === 0 ? (
        <EmptyState
          icon={UserRoundPlus}
          title="Không có liên hệ nào chờ phân bổ"
          description='Mọi liên hệ "Đủ tiêu chuẩn" hiện có đều đã được phân bổ cho Sale rồi.'
        />
      ) : (
        <AssignableLeadsTable
          leads={leads.map((l) => ({
            interactionId: l.interactionId,
            customerName: l.customerName,
            phone: l.phoneNormalized ?? l.phoneRaw ?? "—",
            branchName: l.assignedBranch.name,
            sourceName: l.sourceName,
            fanpageName: l.fanpageName,
            receivedAt: l.receivedAt ? l.receivedAt.toISOString() : null,
          }))}
          sales={sales.map((s) => ({ email: s.email, fullName: s.fullName }))}
        />
      )}
    </>
  );
}
