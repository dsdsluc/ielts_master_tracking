"use client";

import { useState, type ReactNode } from "react";
import { Building2, CircleDot, Flag, Share2, Tag } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type TabKey = "branches" | "sources" | "fanpages" | "statuses" | "objects";

export function AdminCatalogTabs({
  branchesPanel,
  sourcesPanel,
  fanpagesPanel,
  statusesPanel,
  objectsPanel,
}: {
  branchesPanel: ReactNode;
  sourcesPanel: ReactNode;
  fanpagesPanel: ReactNode;
  statusesPanel: ReactNode;
  objectsPanel: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("branches");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
      <TabsList className="mb-5 rounded-full bg-secondary/70 p-1">
        <TabsTrigger value="branches">
          <Building2 className="size-3.5" /> Cơ sở
        </TabsTrigger>
        <TabsTrigger value="sources">
          <Share2 className="size-3.5" /> Nguồn
        </TabsTrigger>
        <TabsTrigger value="fanpages">
          <Flag className="size-3.5" /> Fanpage
        </TabsTrigger>
        <TabsTrigger value="statuses">
          <CircleDot className="size-3.5" /> Trạng thái
        </TabsTrigger>
        <TabsTrigger value="objects">
          <Tag className="size-3.5" /> Đối tượng khách hàng
        </TabsTrigger>
      </TabsList>
      <TabsContent value="branches">{branchesPanel}</TabsContent>
      <TabsContent value="sources">{sourcesPanel}</TabsContent>
      <TabsContent value="fanpages">{fanpagesPanel}</TabsContent>
      <TabsContent value="statuses">{statusesPanel}</TabsContent>
      <TabsContent value="objects">{objectsPanel}</TabsContent>
    </Tabs>
  );
}
