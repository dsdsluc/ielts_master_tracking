export function RatioBar({ qualified, spam }: { qualified: number; spam: number }) {
  const total = qualified + spam;
  if (total === 0) return <span className="text-xs text-muted-foreground">Chưa có dữ liệu</span>;

  const qPct = (qualified / total) * 100;

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-24 overflow-hidden rounded-full bg-secondary">
        {qualified > 0 && <div className="h-full bg-status-qualified" style={{ width: `${qPct}%` }} />}
        {spam > 0 && qualified > 0 && <div className="w-0.5 shrink-0 bg-card" />}
        {spam > 0 && <div className="h-full flex-1 bg-status-spam" />}
      </div>
      <span className="font-mono text-xs text-muted-foreground">{Math.round(qPct)}%</span>
    </div>
  );
}
