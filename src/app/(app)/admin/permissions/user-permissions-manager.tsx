"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormMessage } from "@/components/form-message";
import { UserPermissionsTable } from "@/app/(app)/admin/permissions/user-permissions-table";
import { updateUserFeaturePermissions } from "@/app/(app)/admin/permissions/actions";
import {
  PERMISSION_FEATURES,
  PERMISSION_FEATURE_GROUPS,
  type PermissionFeatureKey,
  type PermissionActionKey,
  type UserPermissionCell,
} from "@/app/(app)/admin/permissions/permission-types";

export type PermissionUser = { email: string; fullName: string; role: string };
export type UserGrants = Record<PermissionFeatureKey, UserPermissionCell>;

/** Cấp quyền riêng cho ĐÚNG 1 người dùng — chỉ mở thêm (hoặc thu hồi bớt)
 * 1 vài trang cụ thể cho họ mà không đụng tới cả vai trò (vd 1 Saler cụ thể
 * được xem thêm /ads-cost, hoặc bị rút lại 1 trang mà Saler khác vẫn có).
 * Mỗi feature CHƯA tuỳ chỉnh riêng thì hiển thị SẴN đúng quyền mặc định
 * theo vai trò (không để trống) — bấm Lưu sẽ ghi thành quyền RIÊNG của
 * người này, từ đó về sau feature đó không còn phụ thuộc vai trò nữa (xem
 * canAccessFeature() ở lib/auth/feature-access.ts). Chọn người ở trên, sửa
 * lưới bên dưới, Lưu chỉ gửi đúng người đang chọn — khác PermissionsManager
 * (gửi cả lô mọi vai trò cùng lúc) vì ở đây luôn chỉ có 1 người đang được
 * sửa tại một thời điểm. */
export function UserPermissionsManager({
  users,
  initialData,
  overriddenFeatures,
}: {
  users: PermissionUser[];
  initialData: Record<string, UserGrants>;
  overriddenFeatures: Record<string, PermissionFeatureKey[]>;
}) {
  const router = useRouter();
  const [selectedEmail, setSelectedEmail] = useState(users[0]?.email ?? "");
  const [saved, setSaved] = useState(initialData);
  const [draft, setDraft] = useState(initialData);
  const [overrides, setOverrides] = useState(overriddenFeatures);
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedUser = users.find((u) => u.email === selectedEmail) ?? null;
  const currentGrants = draft[selectedEmail];
  const dirty = JSON.stringify(draft[selectedEmail]) !== JSON.stringify(saved[selectedEmail]);
  const overriddenSet = useMemo(() => new Set(overrides[selectedEmail] ?? []), [overrides, selectedEmail]);

  const userItems = useMemo(() => Object.fromEntries(users.map((u) => [u.email, `${u.fullName} (${u.role})`])), [users]);

  function selectUser(email: string) {
    setSelectedEmail(email);
    setJustSaved(false);
    setError(null);
  }

  function toggle(feature: PermissionFeatureKey, action: PermissionActionKey) {
    setDraft((prev) => ({
      ...prev,
      [selectedEmail]: { ...prev[selectedEmail], [feature]: { ...prev[selectedEmail][feature], [action]: !prev[selectedEmail][feature][action] } },
    }));
    setJustSaved(false);
    setError(null);
  }

  async function handleSave() {
    if (!selectedEmail) return;
    setPending(true);
    setError(null);
    try {
      const rows = PERMISSION_FEATURES.map((feature) => ({ feature: feature.key, ...draft[selectedEmail][feature.key] }));
      await updateUserFeaturePermissions(selectedEmail, rows);
      setSaved((prev) => ({ ...prev, [selectedEmail]: draft[selectedEmail] }));
      // Lưu là ghi TOÀN BỘ lưới thành quyền riêng — mọi feature của người này
      // giờ đều đã "tuỳ chỉnh riêng", không còn phụ thuộc vai trò nữa.
      setOverrides((prev) => ({ ...prev, [selectedEmail]: PERMISSION_FEATURES.map((f) => f.key) }));
      setJustSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được.");
    } finally {
      setPending(false);
    }
  }

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có Marketing/Saler/Leader nào đang hoạt động để cấp quyền riêng.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="shadow-bubble flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-card p-4 sm:max-w-md">
        <Label htmlFor="user-permission-picker" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserCog className="size-3.5" /> Chọn người dùng
        </Label>
        <Select value={selectedEmail} onValueChange={(v) => v && selectUser(v)} items={userItems}>
          <SelectTrigger id="user-permission-picker" className="h-11 w-full rounded-xl bg-background">
            <SelectValue placeholder="Chọn người dùng…" />
          </SelectTrigger>
          <SelectContent>
            {users.map((u) => (
              <SelectItem key={u.email} value={u.email}>
                {u.fullName} ({u.role})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedUser && <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{selectedUser.email}</p>}
      </div>

      {currentGrants && (
        <div className="flex flex-col gap-8">
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-muted-foreground/40" /> Theo mặc định vai trò {selectedUser?.role}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-primary" /> Đã tuỳ chỉnh riêng cho người này (mở thêm hoặc thu hồi bớt)
            </span>
          </p>
          {PERMISSION_FEATURE_GROUPS.map(({ group, features }) => (
            <div key={group}>
              <h2 className="mb-3 border-b border-border/70 pb-2 font-heading text-base font-semibold text-foreground">{group}</h2>
              <UserPermissionsTable features={features} grants={currentGrants} overriddenKeys={overriddenSet} onToggle={toggle} />
            </div>
          ))}
        </div>
      )}

      <div className="shadow-bubble flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4">
        {error && <FormMessage kind="error">{error}</FormMessage>}
        {!error && dirty && !pending && <span className="text-xs text-muted-foreground">Có thay đổi chưa lưu.</span>}
        {!error && justSaved && !dirty && <span className="text-xs text-status-qualified">Đã cập nhật.</span>}
        <Button type="button" onClick={handleSave} disabled={!dirty || pending} className="rounded-full px-5">
          {pending ? <LoaderCircle className="animate-spin" /> : <ShieldCheck className="size-4" />}
          Cập nhật quyền cho {selectedUser?.fullName ?? "người dùng này"}
        </Button>
      </div>
    </div>
  );
}
