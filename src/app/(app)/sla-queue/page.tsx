import Link from "next/link";
import { TimerOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { CAN_REASSIGN, STATUS } from "@/lib/interactions/constants";
import { getSlaHours } from "@/lib/interactions/settings";
import { listItemInclude, toListItem } from "@/lib/interactions/serialize";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/app/(app)/leads/lead-format";

function hoursSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
}

// Leader/Admin nhìn thấy CỤ THỂ liên hệ nào đang trễ (không chỉ số trung bình
// avgQualifyHours ở dashboard "/") để có thể nhắc trực tiếp Sale phụ trách
// hoặc tự can thiệp — mirror /admin/sla-review nhưng chỉ đọc (không có bước
// "đánh dấu" — đó vẫn là công cụ audit riêng của Admin) và lọc theo phạm vi
// cơ sở của actor thay vì luôn toàn hệ thống.
export default async function SlaQueuePage() {
  const actor = await requireRole(...CAN_REASSIGN);
  const slaHours = await getSlaHours();
  const cutoff = new Date(Date.now() - slaHours * 3600_000);

  const [rows, branches] = await Promise.all([
    prisma.interaction.findMany({
      where: { ...branchScopeWhere(actor), activeFlag: true, statusName: STATUS.WAITING, createdLeadAt: { lte: cutoff } },
      include: listItemInclude,
      orderBy: { createdLeadAt: "asc" },
    }),
    prisma.branch.findMany({ select: { code: true, name: true } }),
  ]);
  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));
  const items = rows.map(toListItem);

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Liên hệ chờ phản hồi quá lâu"
        description={`Liên hệ tạo hơn ${slaHours} giờ trước mà vẫn chưa được Sale nào liên hệ (còn ở trạng thái Chờ) — nhắc trực tiếp Sale phụ trách hoặc tự xử lý nếu cần. Ngưỡng chỉnh ở "Cấu hình hệ thống".`}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={TimerOff}
          title="Không có liên hệ nào quá hạn"
          description="Mọi liên hệ mới trong phạm vi của bạn đều đang trong ngưỡng SLA hiện tại."
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{items.length}</strong> liên hệ quá hạn
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Nguồn / Fanpage</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đã tạo</TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.interactionId} className="odd:bg-secondary/10">
                    <TableCell className="min-w-40 px-5 py-3.5">
                      <p className="max-w-56 truncate font-medium text-foreground">{item.customerName}</p>
                    </TableCell>
                    <TableCell className="px-4 text-sm text-muted-foreground">
                      {branchNames[item.assignedBranchCode] ?? item.assignedBranchCode}
                    </TableCell>
                    <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">
                      <p className="max-w-48 truncate">{item.fanpageName}</p>
                      <p className="text-xs">{item.sourceName}</p>
                    </TableCell>
                    <TableCell className="px-4 text-xs">
                      <span className="text-muted-foreground">{formatDateTime(item.createdLeadAt)}</span>
                      <br />
                      <span className="font-medium text-destructive">{hoursSince(item.createdLeadAt)} giờ trước</span>
                    </TableCell>
                    <TableCell className="pr-4 pl-1 text-right">
                      <Link href={`/leads/${item.interactionId}`} className="text-xs font-medium text-status-received hover:underline">
                        Mở
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}
