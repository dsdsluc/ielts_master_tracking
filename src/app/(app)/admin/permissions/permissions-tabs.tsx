"use client";

import { useState } from "react";
import { ShieldCheck, UserCog } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PermissionsManager } from "@/app/(app)/admin/permissions/permissions-manager";
import { UserPermissionsManager, type PermissionUser, type UserGrants } from "@/app/(app)/admin/permissions/user-permissions-manager";
import type { PermissionFeatureKey, PermissionRow } from "@/app/(app)/admin/permissions/permission-types";

type TabKey = "role" | "user";

const TAB_DESCRIPTIONS: Record<TabKey, string> = {
  role: "Tick bất kỳ cột nào (Thêm/Sửa/Xóa/Báo cáo) để cấp quyền truy cập trang tương ứng cho CẢ vai trò. Admin luôn có đủ quyền, không cần cấu hình.",
  user: "Cấp quyền riêng cho ĐÚNG 1 người dùng — dùng khi chỉ muốn mở 1 vài trang cho riêng người đó (vd 1 Saler cụ thể), không phải mở cho cả vai trò. Cộng dồn với quyền theo vai trò ở trên, không thay thế.",
};

export function PermissionsTabs({
  roleData,
  users,
  userData,
}: {
  roleData: Record<PermissionFeatureKey, PermissionRow[]>;
  users: PermissionUser[];
  userData: Record<string, UserGrants>;
}) {
  const [tab, setTab] = useState<TabKey>("role");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
      <PageHeader
        eyebrow="Quản trị"
        title="Phân quyền"
        description={TAB_DESCRIPTIONS[tab]}
        action={
          <TabsList className="rounded-full bg-secondary/70 p-1">
            <TabsTrigger value="role">
              <ShieldCheck className="size-3.5" /> Theo vai trò
            </TabsTrigger>
            <TabsTrigger value="user">
              <UserCog className="size-3.5" /> Theo người dùng
            </TabsTrigger>
          </TabsList>
        }
      />
      <TabsContent value="role">
        <PermissionsManager initialData={roleData} />
      </TabsContent>
      <TabsContent value="user">
        <UserPermissionsManager users={users} initialData={userData} />
      </TabsContent>
    </Tabs>
  );
}
