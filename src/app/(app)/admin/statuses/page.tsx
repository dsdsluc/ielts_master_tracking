import { CircleDot } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { StatusDialog } from "@/app/(app)/admin/statuses/status-dialog";

export default async function StatusesPage() {
  const statuses = await prisma.status.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Trạng thái"
        description="4 trạng thái cố định theo quy trình xử lý liên hệ — không thêm/xoá được, chỉ chỉnh thứ tự hiển thị và ghi chú."
      />

      {statuses.length === 0 ? (
        <EmptyState
          icon={CircleDot}
          title="Chưa có trạng thái nào"
          description="Trạng thái được hệ thống khởi tạo sẵn theo quy trình xử lý liên hệ."
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{statuses.length}</strong> trạng thái
            </p>
          </div>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
                <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Thứ tự</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Trạng thái đóng</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Yêu cầu SĐT</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Ghi chú</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map((s) => (
                <TableRow key={s.name} className="odd:bg-secondary/10">
                  <TableCell className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <CircleDot className="size-3.5" />
                      </span>
                      <p className="font-medium text-foreground">{s.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-center font-mono text-sm text-muted-foreground">{s.sortOrder}</TableCell>
                  <TableCell className="hidden px-4 sm:table-cell">
                    <Badge variant={s.isClosingStatus ? "default" : "outline"}>{s.isClosingStatus ? "Có" : "Không"}</Badge>
                  </TableCell>
                  <TableCell className="hidden px-4 sm:table-cell">
                    <Badge variant={s.requirePhone ? "default" : "outline"}>{s.requirePhone ? "Có" : "Không"}</Badge>
                  </TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">
                    <p className="max-w-56 truncate">{s.note ?? "—"}</p>
                  </TableCell>
                  <TableCell className="pr-4 pl-1">
                    <StatusDialog status={{ name: s.name, sortOrder: s.sortOrder, note: s.note }} />
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
