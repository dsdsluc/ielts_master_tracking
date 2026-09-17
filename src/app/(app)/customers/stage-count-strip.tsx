import Link from "next/link";

export function StageCountStrip({ counts }: { counts: { label: string; count: number; href?: string }[] }) {
  return (
    <div className="shadow-bubble flex flex-wrap items-stretch gap-2 overflow-hidden rounded-2xl border border-border/70 bg-card p-2">
      {counts.map((c) => {
        const content = (
          <>
            <span className="font-heading text-lg font-semibold tabular-nums text-foreground">{c.count}</span>
            <span className="truncate text-xs text-muted-foreground" title={c.label}>{c.label}</span>
          </>
        );
        return c.href ? (
          <Link
            key={c.label}
            href={c.href}
            className="flex min-w-24 flex-1 flex-col gap-0.5 rounded-xl px-3 py-2 transition-colors hover:bg-secondary/60"
          >
            {content}
          </Link>
        ) : (
          <div key={c.label} className="flex min-w-24 flex-1 flex-col gap-0.5 rounded-xl px-3 py-2">
            {content}
          </div>
        );
      })}
    </div>
  );
}
