"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BrandMark } from "@/components/layout/brand-mark";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SidebarUser } from "@/components/layout/sidebar-user";
import type { CurrentUser } from "@/lib/auth/dal";

export function MobileNav({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Mở menu điều hướng"
      >
        <Menu className="size-5" />
      </Button>
      <SheetContent
        side="left"
        className="flex w-66 flex-col gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-66"
      >
        <SheetHeader className="h-16 shrink-0 flex-row items-center gap-0 border-b border-sidebar-border px-3 py-0">
          <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
          <BrandMark />
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="py-4">
            <SidebarNav role={user.role} onNavigate={() => setOpen(false)} />
          </div>
        </ScrollArea>
        <div className="border-t border-sidebar-border p-3">
          <SidebarUser user={user} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
