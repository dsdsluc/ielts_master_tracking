"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getNavGroupsForRole } from "@/lib/nav";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  role,
  collapsed = false,
  onNavigate,
}: {
  role: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const navGroups = getNavGroupsForRole(role);

  return (
    <nav className="flex flex-col gap-5 px-2">
      {navGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p
            className={cn(
              "overflow-hidden px-2.5 font-condensed text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground/70 uppercase transition-all duration-200",
              collapsed ? "mb-0 h-0 opacity-0" : "mb-1 h-4 opacity-100"
            )}
          >
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 overflow-hidden rounded-xl py-2.5 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-0" : "px-2.5",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                <span
                  className={cn(
                    "truncate whitespace-nowrap transition-[width,opacity] duration-200",
                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                  )}
                >
                  {item.title}
                </span>
              </Link>
            );

            if (!collapsed) return link;

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={link} />
                <TooltipContent side="right">{item.title}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
