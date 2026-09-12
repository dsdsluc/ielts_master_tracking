import Link from "next/link";

// Đếm số học viên đang dừng ở mỗi mốc — dùng chung giữa "Học viên đang tư
// vấn" (theo 1 actor) và "Thống kê tư vấn học viên" (toàn đội).
//
// Truyền `getHref` để biến mỗi mốc thành 1 bộ lọc bấm được (vd. trang thống
// kê — bấm "Chưa gọi" để xem đúng danh sách học viên đang ở mốc đó); không
// truyền thì hiển thị dạng tĩnh như cũ (trang "Học viên đang tư vấn").
export function StageCountStrip({
  counts,
  getHref,
  selected,
}: {
  counts: { label: string; count: number }[];
  getHref?: (label: string) => string;
  selected?: string | null;
}) {
  return (
    <div className="shadow-bubble mb-6 flex flex-wrap gap-2 rounded-2xl border border-border/70 bg-card p-4">
      {counts.map(({ label, count }) => {
        const isSelected = selected === label;
        const className = `flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          isSelected
            ? "bg-primary text-primary-foreground"
            : count > 0
              ? "bg-secondary/60 text-foreground"
              : "text-muted-foreground/60"
        }`;
        const content = (
          <>
            <span>{label}</span>
            <span className="font-mono">{count}</span>
          </>
        );
        if (getHref) {
          return (
            <Link key={label} href={getHref(isSelected ? "" : label)} className={`${className} hover:opacity-80`}>
              {content}
            </Link>
          );
        }
        return (
          <div key={label} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
