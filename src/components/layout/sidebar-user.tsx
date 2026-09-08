import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/dal";

function initialsOf(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  const first = parts.length > 1 ? parts[0] : "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "?";
}

export function SidebarUser({
  user,
  collapsed = false,
}: {
  user: CurrentUser;
  collapsed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 overflow-hidden rounded-xl py-2 transition-[padding] duration-200",
        collapsed ? "justify-center px-0" : "px-2 hover:bg-secondary/60"
      )}
    >
      <span className="glossy flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent-foreground to-accent-foreground/70 font-condensed text-xs font-semibold text-accent">
        {initialsOf(user.fullName)}
      </span>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col leading-tight whitespace-nowrap transition-[width,opacity] duration-200",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        <span className="truncate text-sm font-medium text-foreground">
          {user.fullName}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {user.role}
          {user.branch ? ` · ${user.branch.name}` : ""}
        </span>
      </div>
      {!collapsed && (
        <form action={logout}>
          <button
            type="submit"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </form>
      )}
    </div>
  );
}
