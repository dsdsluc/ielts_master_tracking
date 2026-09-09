"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

// Vài câu để đổi ngẫu nhiên mỗi lần loading hiện lên — đỡ nhàm nếu người dùng
// chuyển trang nhiều lần liên tiếp. Luôn giữ đúng câu đã "chốt" ở vị trí đầu.
const MESSAGES = [
  "Web hơi lag mọi người thông cảm cho dân nghiệp dư này !",
  "Đang tải dữ liệu, chờ xíu nha...",
  "Sắp xong rồi, kiên nhẫn thêm chút nữa nha.",
  "Server đang cố gắng hết sức đây ạ.",
];

// Chỉ hiện sau 1 khoảng trễ nhỏ — điều hướng nhanh (dữ liệu đã cache, trang
// nhẹ) sẽ không thấy gì cả, tránh nháy màn hình gây khó chịu. Chỉ những lượt
// tải thật sự chậm mới lộ ra loading này.
const SHOW_DELAY_MS = 300;

export function AppLoadingScreen() {
  const [show, setShow] = useState(false);
  const [message] = useState(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center animate-in fade-in-0 duration-300">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
        <LoaderCircle className="size-6 animate-spin" />
      </span>
      <p className="max-w-xs text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
