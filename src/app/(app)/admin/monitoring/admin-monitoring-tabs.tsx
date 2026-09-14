"use client";

import { useState, type ReactNode } from "react";
import {
  ShieldAlert,
  SlidersHorizontal,
  TimerOff,
  UserCog,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type TabKey = "giam-sat" | "sla" | "users" | "settings";

// Gộp Giám sát + Rà soát SLA + Người dùng + Cấu hình hệ thống — trước đây mỗi
// thứ 1 route riêng ở nav, giờ chỉ còn 1 mục "Trung tâm quản trị" chia tab
// (mirror cách AdminCatalogTabs gộp Cơ sở/Nguồn/Fanpage/Trạng thái). TabsList
// đặt ở action của PageHeader (góc phải) để chuyển section không cần cuộn trang.
export function AdminMonitoringTabs({
  monitoringPanel,
  slaPanel,
  usersPanel,
  settingsPanel,
}: {
  monitoringPanel: ReactNode;
  slaPanel: ReactNode;
  usersPanel: ReactNode;
  settingsPanel: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("giam-sat");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
      <PageHeader
        eyebrow="Quản trị"
        title="Trung tâm quản trị"
        action={
          <TabsList className="rounded-full bg-secondary/70 p-1">
            <TabsTrigger value="giam-sat">
              <ShieldAlert className="size-3.5" /> Giám sát
            </TabsTrigger>
            <TabsTrigger value="sla">
              <TimerOff className="size-3.5" /> Rà soát SLA
            </TabsTrigger>
            <TabsTrigger value="users">
              <UserCog className="size-3.5" /> Người dùng
            </TabsTrigger>
            <TabsTrigger value="settings">
              <SlidersHorizontal className="size-3.5" /> Cấu hình
            </TabsTrigger>
          </TabsList>
        }
      />
      <TabsContent value="giam-sat">{monitoringPanel}</TabsContent>
      <TabsContent value="sla">{slaPanel}</TabsContent>
      <TabsContent value="users">{usersPanel}</TabsContent>
      <TabsContent value="settings">{settingsPanel}</TabsContent>
    </Tabs>
  );
}
