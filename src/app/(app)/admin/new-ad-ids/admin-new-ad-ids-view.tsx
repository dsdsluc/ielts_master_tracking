import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/app/(app)/ads-cost/format";
import { AdsCostDialog } from "@/app/(app)/ads-cost/ads-cost-dialog";
import type { NewAdIdRow } from "@/app/(app)/new-ad-ids/new-ad-ids-view";

/** Khác với NewAdIdsView (bảng sửa trực tiếp từng dòng ở Workspace Marketing)
 * — bản quản trị này chỉ hiển thị danh sách, bấm vào từng dòng mở dialog điền
 * thông tin (mirror NewLeadDialog ở "Thêm liên hệ mới"/leads) thay vì sửa
 * inline, phù hợp hơn khi Admin xử lý số lượng lớn, không vội. */
export function AdminNewAdIdsView({
  rows,
  sourceOptions,
  fanpageOptions,
  branchOptions,
}: {
  rows: NewAdIdRow[];
  sourceOptions: string[];
  fanpageOptions: string[];
  branchOptions: { code: string; name: string }[];
}) {
  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-mono text-foreground">{rows.length}</strong> Ad ID mới cần xử lý
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader className="bg-secondary/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ad ID</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Số liên hệ</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">
                Thấy lần đầu
              </TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">
                Nguồn / Fanpage gợi ý
              </TableHead>
              <TableHead className="w-44 pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.adId} className="odd:bg-secondary/10">
                <TableCell className="min-w-32 px-5 py-3.5 font-mono text-sm text-foreground">{row.adId}</TableCell>
                <TableCell className="px-4 text-sm text-muted-foreground">{row.leadCount}</TableCell>
                <TableCell className="hidden px-4 text-xs text-muted-foreground sm:table-cell">{formatDate(row.firstSeenAt)}</TableCell>
                <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">
                  {row.suggestedSourceName} · {row.suggestedFanpageName}
                </TableCell>
                <TableCell className="pr-5">
                  <AdsCostDialog
                    mode="create"
                    defaultAdId={row.adId}
                    triggerLabel="Điền thông tin"
                    initialValues={{
                      sourceName: row.suggestedSourceName,
                      fanpageName: row.suggestedFanpageName,
                      branchCode: row.suggestedBranchCode,
                      periodStart: row.firstSeenAt.slice(0, 10),
                    }}
                    sourceOptions={sourceOptions}
                    fanpageOptions={fanpageOptions}
                    branchOptions={branchOptions}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
