import { cn } from "@/lib/utils";

export function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
      <span
        className={cn(
          "glossy flex h-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary/70 font-condensed text-xs font-semibold text-primary-foreground transition-[width] duration-200",
          collapsed ? "w-8" : "w-0 opacity-0"
        )}
      >
        IM
      </span>
      <span
        className={cn(
          "truncate font-heading text-[15px] font-semibold tracking-tight text-foreground transition-[width,opacity] duration-200 whitespace-nowrap",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
        )}
      >
        IELTS Master
      </span>
    </div>
  );
}
