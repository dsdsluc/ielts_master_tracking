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
  user: "Mặc định mỗi người được hiển thị sẵn đúng quyền theo vai trò của họ. Chỉ khi bấm Lưu, lưới hiện tại mới trở thành quyền RIÊNG cho người đó và ĐÈ LÊN quyền theo vai trò (mở thêm hoặc thu hồi bớt) — vai trò ở tab bên kia chỉ là mặc định ban đầu.",
};

export function PermissionsTabs({
  roleData,
  users,
  userData,
  overriddenFeatures,
}: {
  roleData: Record<PermissionFeatureKey, PermissionRow[]>;
  users: PermissionUser[];
  userData: Record<string, UserGrants>;
  overriddenFeatures: Record<string, PermissionFeatureKey[]>;
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
        <UserPermissionsManager users={users} initialData={userData} overriddenFeatures={overriddenFeatures} />
      </TabsContent>
    </Tabs>
  );
}
