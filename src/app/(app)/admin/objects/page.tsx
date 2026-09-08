import { Tag } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { ActiveToggle } from "@/app/(app)/admin/active-toggle";
import { ObjectDialog } from "@/app/(app)/admin/objects/object-dialog";
import { setObjectActive } from "@/app/(app)/admin/objects/actions";

export default async function ObjectsPage() {
  const objects = await prisma.customerObject.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Đối tượng"
        description="Phân loại đối tượng khách hàng: HS-SV, phụ huynh, người đi làm..."
        action={<ObjectDialog mode="create" />}
      />

      {objects.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="Chưa có đối tượng nào"
          description="Thêm đối tượng để phân loại khách hàng khi tạo liên hệ."
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{objects.length}</strong> đối tượng
            </p>
          </div>
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đối tượng</TableHead>
                <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Thứ tự</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Hoạt động</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {objects.map((o) => (
                <TableRow key={o.name} className="odd:bg-secondary/10">
                  <TableCell className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <Tag className="size-3.5" />
                      </span>
                      <p className="font-medium text-foreground">{o.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-center font-mono text-sm text-muted-foreground">{o.sortOrder}</TableCell>
                  <TableCell className="px-4">
                    <ActiveToggle active={o.active} entityKey={o.name} action={setObjectActive} />
                  </TableCell>
                  <TableCell className="pr-4 pl-1">
                    <ObjectDialog mode="edit" object={{ name: o.name, sortOrder: o.sortOrder }} />
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
