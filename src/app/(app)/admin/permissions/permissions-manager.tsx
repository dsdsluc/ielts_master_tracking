"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-message";
import { PermissionsTable } from "@/app/(app)/admin/permissions/permissions-table";
import { updateFeaturePermissions } from "@/app/(app)/admin/permissions/actions";
import {
  PERMISSION_FEATURES,
  PERMISSION_FEATURE_GROUPS,
  type PermissionFeatureKey,
  type PermissionRow,
  type PermissionActionKey,
} from "@/app/(app)/admin/permissions/permission-types";

function FeatureSubheading({ title }: { title: string }) {
  return (
    <h3 className="mb-3 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {title}
    </h3>
  );
}

function GroupHeading({ title }: { title: string }) {
  return (
    <h2 className="mb-4 border-b border-border/70 pb-2 font-heading text-base font-semibold text-foreground">
      {title}
    </h2>
  );
}

// 1 nút DUY NHẤT cập nhật quyền cho TOÀN BỘ tính năng cùng lúc, thay vì mỗi
// bảng 1 nút riêng — gửi nguyên cả N dòng (N tính năng x 3 vai trò, mỗi
// tính năng khớp 1 mục nav) lên updateFeaturePermissions() mỗi lần bấm.
export function PermissionsManager({
  initialData,
}: {
  initialData: Record<PermissionFeatureKey, PermissionRow[]>;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialData);
  const [draft, setDraft] = useState(initialData);
  const [pending, setPending] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function toggle(feature: PermissionFeatureKey, role: string, action: PermissionActionKey) {
    setDraft((prev) => ({
      ...prev,
      [feature]: prev[feature].map((row) => (row.role === role ? { ...row, [action]: !row[action] } : row)),
    }));
    setJustSaved(false);
    setError(null);
  }

  async function handleUpdate() {
    setPending(true);
    setError(null);
    try {
      const rows = PERMISSION_FEATURES.flatMap((feature) => draft[feature.key].map((row) => ({ feature: feature.key, ...row })));
      await updateFeaturePermissions(rows);
      setSaved(draft);
      setJustSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {PERMISSION_FEATURE_GROUPS.map(({ group, features }) => (
        <div key={group}>
          <GroupHeading title={group} />
          <div className="flex flex-col gap-8">
            {features.map((feature) => (
              <div key={feature.key}>
                <FeatureSubheading title={feature.label} />
                <PermissionsTable
                  rows={draft[feature.key]}
                  onToggle={(role, action) => toggle(feature.key, role, action)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="shadow-bubble flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4">
        {error && <FormMessage kind="error">{error}</FormMessage>}
        {!error && dirty && !pending && <span className="text-xs text-muted-foreground">Có thay đổi chưa lưu.</span>}
        {!error && justSaved && !dirty && <span className="text-xs text-status-qualified">Đã cập nhật.</span>}
        <Button type="button" onClick={handleUpdate} disabled={!dirty || pending} className="rounded-full px-5">
          {pending ? <LoaderCircle className="animate-spin" /> : <ShieldCheck className="size-4" />}
          Cập nhật quyền
        </Button>
      </div>
    </div>
  );
}
