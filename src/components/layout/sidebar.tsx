"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/layout/brand-mark";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SidebarUser } from "@/components/layout/sidebar-user";
import { useSidebar } from "@/components/layout/sidebar-context";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/auth/dal";

export function Sidebar({ user }: { user: CurrentUser }) {
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        "hidden h-screen min-h-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out lg:flex",
        collapsed ? "w-19" : "w-66"
      )}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3">
        <BrandMark collapsed={collapsed} />
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label="Thu gọn sidebar"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="py-4">
          <SidebarNav role={user.role} collapsed={collapsed} />
        </div>
      </ScrollArea>

      <div className="flex shrink-0 flex-col gap-2 border-t border-sidebar-border p-3">
        {collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label="Mở rộng sidebar"
            className="mx-auto text-muted-foreground hover:text-foreground"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        )}
        <SidebarUser user={user} collapsed={collapsed} />
      </div>
    </aside>
  );
}
