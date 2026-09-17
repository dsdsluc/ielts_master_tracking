import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { ChevronRight, MessageCircleOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { STATUS } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { MissingConversationFilterBar } from "@/app/(app)/admin/missing-conversation/missing-conversation-filter-bar";

const MAX_ROWS = 200;

// Liên hệ CHƯA có link cuộc hội thoại thật (null hoặc "" — xem
// resolveExternalLeadInfo() ở lib/interactions/lead-info.ts, kênh "Ngoài" luôn
// để trống) VÀ chưa Đủ tiêu chuẩn — không đối chiếu được nên không thể đánh
// dấu Spam (xem check tương ứng ở updateStatus() trong mutations.ts). Trang
// này giúp Admin/Leader chủ động tìm và bổ sung link còn thiếu.
export default async function MissingConversationPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; source?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user.role, "missingConversation");
  const { branch, source, status } = await searchParams;

  const [branches, sourceRows] = await Promise.all([
    prisma.branch.findMany({ where: { active: true }, select: { code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.source.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  const where: Prisma.InteractionWhereInput = {
    activeFlag: true,
    OR: [{ conversationLink: null }, { conversationLink: "" }],
    statusName: status && status !== "all" ? status : { not: STATUS.PHONE },
  };
  if (branch && branch !== "all") where.assignedBranchCode = branch;
  if (source && source !== "all") where.sourceName = source;

  const rows = await prisma.interaction.findMany({
    where,
    select: {
      interactionId: true,
      customerName: true,
      statusName: true,
      sourceName: true,
      fanpageName: true,
      assignedBranchCode: true,
      createdLeadAt: true,
      assignedSale: { select: { fullName: true } },
    },
    orderBy: { createdLeadAt: "desc" },
    take: MAX_ROWS,
  });

  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Thiếu link hội thoại"
        description="Liên hệ chưa Đủ tiêu chuẩn và chưa có link cuộc hội thoại — không thể đối chiếu nên cũng không đánh dấu Spam được, cần bổ sung link ở trang chi tiết liên hệ."
      />

      <MissingConversationFilterBar branches={branches} sources={sourceRows.map((s) => s.name)} />

      {rows.length === 0 ? (
        <EmptyState
          icon={MessageCircleOff}
          title="Không có liên hệ nào thiếu link hội thoại"
          description="Mọi liên hệ chưa Đủ tiêu chuẩn khớp bộ lọc hiện tại đều đã có link cuộc hội thoại."
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{rows.length}</strong> liên hệ thiếu link hội thoại
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Nguồn / Fanpage</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Tư vấn viên</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Tạo lúc</TableHead>
                  <TableHead className="w-12 pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.interactionId} className="odd:bg-secondary/10">
                    <TableCell className="min-w-40 px-5 py-3.5">
                      <p className="max-w-56 truncate font-medium text-foreground" title={row.customerName}>
                        {row.customerName}
                      </p>
                    </TableCell>
                    <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">
                      <p className="max-w-48 truncate" title={`${row.sourceName} · ${row.fanpageName}`}>
                        {row.sourceName} · {row.fanpageName}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 text-sm text-muted-foreground">{branchNames[row.assignedBranchCode] ?? row.assignedBranchCode}</TableCell>
                    <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">{row.assignedSale?.fullName ?? "Chưa gán"}</TableCell>
                    <TableCell className="px-4">
                      <StatusPill status={row.statusName} />
                    </TableCell>
                    <TableCell className="hidden px-4 text-xs text-muted-foreground lg:table-cell">{formatDateTime(row.createdLeadAt.toISOString())}</TableCell>
                    <TableCell className="pr-5 pl-1">
                      <Link
                        href={`/leads/${row.interactionId}`}
                        className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label="Xem chi tiết"
                      >
                        <ChevronRight className="size-4" />
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
