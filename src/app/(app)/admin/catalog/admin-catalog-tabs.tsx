"use client";

import { useState, type ReactNode } from "react";
import { Building2, CircleDot, Flag, Share2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type TabKey = "branches" | "sources" | "fanpages" | "statuses";

export function AdminCatalogTabs({
  branchesPanel,
  sourcesPanel,
  fanpagesPanel,
  statusesPanel,
}: {
  branchesPanel: ReactNode;
  sourcesPanel: ReactNode;
  fanpagesPanel: ReactNode;
  statusesPanel: ReactNode;
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
      </TabsList>
      <TabsContent value="branches">{branchesPanel}</TabsContent>
      <TabsContent value="sources">{sourcesPanel}</TabsContent>
      <TabsContent value="fanpages">{fanpagesPanel}</TabsContent>
      <TabsContent value="statuses">{statusesPanel}</TabsContent>
    </Tabs>
  );
}
