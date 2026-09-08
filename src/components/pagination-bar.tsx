import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaginationBar({
  page,
  totalPages,
  totalItems,
  onPageChange,
  compact = false,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /** Gọn 1 dòng prev/số trang/next — dùng khi đặt inline trong 1 header hẹp. */
  compact?: boolean;
}) {
  if (totalPages <= 1) return null;

  if (compact) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          {page}/{totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    );
  }

  const pageNumbers = buildPageNumbers(page, totalPages);

  return (
    <div className="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Trang <strong className="font-mono text-foreground">{page}</strong>/{totalPages} ·{" "}
        <strong className="font-mono text-foreground">{totalItems}</strong> liên hệ
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pageNumbers.map((n, i) =>
          n === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={n}
              type="button"
              variant={n === page ? "default" : "outline"}
              size="icon-sm"
              className="rounded-full"
              onClick={() => onPageChange(n)}
              aria-current={n === page ? "page" : undefined}
            >
              {n}
            </Button>
          )
        )}
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Luôn hiện trang đầu/cuối + 1 lân cận mỗi bên trang hiện tại, còn lại rút gọn bằng "…". */
function buildPageNumbers(page: number, totalPages: number): (number | "…")[] {
  const result: (number | "…")[] = [];
  const add = (n: number) => result.push(n);

  const windowStart = Math.max(2, page - 1);
  const windowEnd = Math.min(totalPages - 1, page + 1);

  add(1);
  if (windowStart > 2) result.push("…");
  for (let n = windowStart; n <= windowEnd; n++) add(n);
  if (windowEnd < totalPages - 1) result.push("…");
  if (totalPages > 1) add(totalPages);

  return result;
}
