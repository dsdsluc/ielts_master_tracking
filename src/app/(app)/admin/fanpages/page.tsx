import { Flag } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { ActiveToggle } from "@/app/(app)/admin/active-toggle";
import { FanpageDialog } from "@/app/(app)/admin/fanpages/fanpage-dialog";
import { setFanpageActive } from "@/app/(app)/admin/fanpages/actions";

export default async function FanpagesPage() {
  // Lấy tất cả (không lọc active) — nếu chỉ lọc active thì fanpage đang gắn với
  // 1 nguồn/cơ sở đã bị ngừng sẽ không hiện được lựa chọn hiện tại trong dialog sửa.
  const [fanpages, sources, branches] = await Promise.all([
    prisma.fanpage.findMany({ orderBy: { name: "asc" } }),
    prisma.source.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const sourceOptions = sources.map((s) => s.name);
  const branchNameByCode = new Map(branches.map((b) => [b.code, b.name]));

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Fanpage"
        description="Fanpage tiếp nhận lead, kèm Nguồn mặc định và Cơ sở gợi ý."
        action={<FanpageDialog mode="create" sourceOptions={sourceOptions} branchOptions={branches} />}
      />

      {fanpages.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Chưa có fanpage nào"
          description="Thêm fanpage để hệ thống tự gợi ý nguồn và cơ sở khi tạo liên hệ."
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{fanpages.length}</strong> fanpage
            </p>
          </div>
          <Table className="sm:min-w-[720px]">
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Fanpage</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Nguồn mặc định</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Cơ sở gợi ý</TableHead>
                <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Bắt buộc Ad ID</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Hoạt động</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fanpages.map((f) => (
                <TableRow key={f.name} className="odd:bg-secondary/10">
                  <TableCell className="min-w-56 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <Flag className="size-3.5" />
                      </span>
                      <p className="truncate font-medium text-foreground">{f.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">{f.defaultSourceName}</TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                    {branchNameByCode.get(f.suggestedBranchCode) ?? f.suggestedBranchCode}
                  </TableCell>
                  <TableCell className="hidden px-4 text-center text-sm text-muted-foreground md:table-cell">{f.requireAdId ? "Có" : "Không"}</TableCell>
                  <TableCell className="px-4">
                    <ActiveToggle active={f.active} entityKey={f.name} action={setFanpageActive} />
                  </TableCell>
                  <TableCell className="pr-4 pl-1">
                    <FanpageDialog
                      mode="edit"
                      fanpage={{ name: f.name, defaultSourceName: f.defaultSourceName, suggestedBranchCode: f.suggestedBranchCode, requireAdId: f.requireAdId, note: f.note }}
                      sourceOptions={sourceOptions}
                      branchOptions={branches}
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
