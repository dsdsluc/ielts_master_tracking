import { ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PERMISSION_ACTIONS,
  type PermissionRow,
  type PermissionActionKey,
} from "@/app/(app)/admin/permissions/permission-types";

// Bảng thuần hiển thị + báo sự kiện tick ra ngoài (controlled) — không tự giữ
// state/nút Lưu riêng, vì nhiều bảng (nhiều tính năng) dùng chung 1 nút Lưu
// duy nhất ở PermissionsManager.
export function PermissionsTable({
  rows,
  onToggle,
}: {
  rows: PermissionRow[];
  onToggle: (role: string, action: PermissionActionKey) => void;
}) {
  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      {/* table-fixed — mỗi cột giữ đúng % đã khai báo ở header, checkbox luôn
          nằm giữa đúng cột của nó thay vì co giãn theo nội dung. */}
      <Table className="table-fixed">
        <TableHeader className="bg-secondary/60">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-2/5 px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
              Vai trò
            </TableHead>
            {PERMISSION_ACTIONS.map((action) => (
              <TableHead
                key={action.key}
                className="w-[15%] px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase"
              >
                {action.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.role} className="odd:bg-secondary/10">
              <TableCell className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <ShieldCheck className="size-3.5" />
                  </span>
                  <p className="font-medium text-foreground">{row.role}</p>
                </div>
              </TableCell>
              {PERMISSION_ACTIONS.map((action) => (
                <TableCell key={action.key} className="px-4">
                  <div className="flex justify-center">
                    <Checkbox
                      checked={row[action.key]}
                      onCheckedChange={() => onToggle(row.role, action.key)}
                      aria-label={`${action.label} — ${row.role}`}
                    />
                  </div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
