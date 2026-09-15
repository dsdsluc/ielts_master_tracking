"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {
    // Trình duyệt chặn localStorage (chế độ ẩn danh...) — theme vẫn đổi được
    // trong phiên hiện tại, chỉ không nhớ lại lần sau.
  }
}

/** Bật/tắt giao diện tối — lớp `.dark` trên <html> đã có sẵn đầy đủ CSS
 * (globals.css) từ trước nhưng chưa có cách nào để người dùng bật lên. Giá
 * trị ban đầu đọc từ script chặn render trong layout.tsx (tránh nháy sai
 * giao diện lúc tải trang), component chỉ đọc lại state đó sau khi mount. */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    // Đọc trạng thái .dark thật sự trên <html> (chỉ có ở client, do script
    // chặn render trong layout.tsx gắn vào) — không thể biết trước lúc SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  if (dark === null) {
    return <span className="size-7 shrink-0" aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={() => {
        const next = !dark;
        setDark(next);
        applyTheme(next);
      }}
      aria-label={dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      title={dark ? "Giao diện sáng" : "Giao diện tối"}
      className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
