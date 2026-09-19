import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PERMISSION_ACTIONS,
  type PermissionFeatureKey,
  type PermissionActionKey,
  type UserPermissionCell,
} from "@/app/(app)/admin/permissions/permission-types";

// Mirror PermissionsTable (bảng theo vai trò) nhưng đảo trục — mỗi dòng là 1
// TÍNH NĂNG thay vì 1 vai trò, vì tab "Theo người dùng" chỉ sửa đúng 1 người
// tại một thời điểm (đã chọn ở trên), không cần cột người dùng.
export function UserPermissionsTable({
  features,
  grants,
  overriddenKeys,
  onToggle,
}: {
  features: { key: PermissionFeatureKey; label: string }[];
  grants: Record<PermissionFeatureKey, UserPermissionCell>;
  // Feature nào đã có dòng riêng cho người đang chọn (bất kể true/false) —
  // tô khác màu để phân biệt "đang theo mặc định vai trò" (chưa lưu gì cho
  // riêng người này) với "đã tuỳ chỉnh riêng".
  overriddenKeys: Set<PermissionFeatureKey>;
  onToggle: (feature: PermissionFeatureKey, action: PermissionActionKey) => void;
}) {
  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <Table className="table-fixed">
        <TableHeader className="bg-secondary/60">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-2/5 px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tính năng</TableHead>
            {PERMISSION_ACTIONS.map((action) => (
              <TableHead key={action.key} className="w-[15%] px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                {action.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((feature) => {
            const cell = grants[feature.key];
            const isOverridden = overriddenKeys.has(feature.key);
            return (
              <TableRow key={feature.key} className={isOverridden ? "bg-primary/5" : "odd:bg-secondary/10"}>
                <TableCell className="px-5 py-3 font-medium text-foreground">
                  <span className={`mr-2 inline-block size-1.5 rounded-full align-middle ${isOverridden ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  {feature.label}
                </TableCell>
                {PERMISSION_ACTIONS.map((action) => (
                  <TableCell key={action.key} className="px-4">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={cell[action.key]}
                        onCheckedChange={() => onToggle(feature.key, action.key)}
                        aria-label={`${action.label} — ${feature.label}`}
                      />
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
