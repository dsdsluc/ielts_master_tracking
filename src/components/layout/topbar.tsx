"use client";

import { usePathname } from "next/navigation";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getNavTitle } from "@/lib/nav";
import type { CurrentUser } from "@/lib/auth/dal";

export function TopBar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const title = getNavTitle(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:hidden">
      <MobileNav user={user} />
      <span className="font-heading text-sm font-medium text-foreground lg:hidden">
        {title}
      </span>
    </header>
  );
}
