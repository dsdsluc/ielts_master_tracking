import { Share2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { ActiveToggle } from "@/app/(app)/admin/active-toggle";
import { SourceDialog } from "@/app/(app)/admin/sources/source-dialog";
import { SourceDomains } from "@/app/(app)/admin/sources/source-domains";
import { setSourceActive } from "@/app/(app)/admin/sources/actions";

export default async function SourcesPage() {
  const sources = await prisma.source.findMany({
    orderBy: { name: "asc" },
    include: { domains: { orderBy: { domain: "asc" } } },
  });

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Nguồn"
        description="Nhóm kênh, nhóm nguồn và domain nhận diện tự động cho từng nguồn."
        action={<SourceDialog mode="create" />}
      />

      {sources.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="Chưa có nguồn nào"
          description="Thêm nguồn để hệ thống nhận diện liên hệ theo domain link."
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{sources.length}</strong> nguồn
            </p>
          </div>
          <Table className="sm:min-w-[720px]">
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Nguồn</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Nhóm kênh / nhóm nguồn</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Domain nhận diện</TableHead>
                <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Bắt buộc Ad ID</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Hoạt động</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((s) => (
                <TableRow key={s.name} className="odd:bg-secondary/10">
                  <TableCell className="min-w-40 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <Share2 className="size-3.5" />
                      </span>
                      <p className="truncate font-medium text-foreground">{s.name}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                    <p className="truncate">{s.channelGroup}</p>
                    <p className="mt-0.5 truncate text-xs">{s.sourceGroup}</p>
                  </TableCell>
                  <TableCell className="min-w-56 px-4">
                    <SourceDomains sourceName={s.name} domains={s.domains} />
                  </TableCell>
                  <TableCell className="hidden px-4 text-center text-sm text-muted-foreground md:table-cell">{s.requireAdId ? "Có" : "Không"}</TableCell>
                  <TableCell className="px-4">
                    <ActiveToggle active={s.active} entityKey={s.name} action={setSourceActive} />
                  </TableCell>
                  <TableCell className="pr-4 pl-1">
                    <SourceDialog
                      mode="edit"
                      source={{ name: s.name, channelGroup: s.channelGroup, sourceGroup: s.sourceGroup, requireAdId: s.requireAdId, note: s.note }}
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
