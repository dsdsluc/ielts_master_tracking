import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { ActiveToggle } from "@/app/(app)/admin/active-toggle";
import { BranchDialog } from "@/app/(app)/admin/branches/branch-dialog";
import { setBranchActive } from "@/app/(app)/admin/branches/actions";

export default async function BranchesPage() {
  const branches = await prisma.branch.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Cơ sở"
        description="Danh sách chi nhánh và SLA nhận/xử lý liên hệ theo từng cơ sở."
        action={<BranchDialog mode="create" />}
      />

      {branches.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Chưa có cơ sở nào"
          description="Thêm cơ sở để gán cho liên hệ và fanpage."
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{branches.length}</strong> cơ sở
            </p>
          </div>
          <Table className="sm:min-w-[720px]">
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
                <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">SLA nhận</TableHead>
                <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">SLA xử lý</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Ghi chú</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Hoạt động</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b.code} className="odd:bg-secondary/10">
                  <TableCell className="min-w-48 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <Building2 className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{b.name}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{b.code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden px-4 text-center text-sm text-muted-foreground sm:table-cell">{b.slaReceiveMinutes} phút</TableCell>
                  <TableCell className="hidden px-4 text-center text-sm text-muted-foreground sm:table-cell">{b.slaProcessHours} giờ</TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">
                    <p className="max-w-56 truncate">{b.note ?? "—"}</p>
                  </TableCell>
                  <TableCell className="px-4">
                    <ActiveToggle active={b.active} entityKey={b.code} action={setBranchActive} />
                  </TableCell>
                  <TableCell className="pr-4 pl-1">
                    <BranchDialog
                      mode="edit"
                      branch={{ code: b.code, name: b.name, slaReceiveMinutes: b.slaReceiveMinutes, slaProcessHours: b.slaProcessHours, note: b.note }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
