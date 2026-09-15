"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

const SHOW_AFTER_PX = 480;

/** Nút nổi "về đầu trang" cho các trang danh sách dài (bảng, feed hoạt
 * động...) — chỉ hiện sau khi đã cuộn đủ xa, tránh chiếm chỗ trên các trang
 * ngắn. Lắng nghe scroll của #app-main-scroll (khung <main> thật sự cuộn),
 * không phải window, vì layout dùng overflow-y-auto trên <main>. */
export function ScrollToTopButton({ scrollContainerId }: { scrollContainerId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(scrollContainerId);
    if (!el) return;

    function onScroll() {
      setVisible(el!.scrollTop > SHOW_AFTER_PX);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollContainerId]);

  return (
    <button
      type="button"
      onClick={() => document.getElementById(scrollContainerId)?.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Về đầu trang"
      title="Về đầu trang"
      className={`shadow-bubble glossy fixed right-5 bottom-5 z-30 flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-200 hover:bg-primary/90 lg:right-8 lg:bottom-8 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <ArrowUp className="size-4" />
    </button>
  );
}
