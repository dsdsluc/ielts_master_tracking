"use client";

import { useEffect } from "react";

// Chỉ kích hoạt khi chính root layout.tsx (hoặc font/CSS) bị lỗi — trường hợp
// hiếm, nên phải tự khai báo <html>/<body> và không phụ thuộc Tailwind/font
// nào để chắc chắn vẫn hiển thị được kể cả khi hệ thống style bị lỗi theo.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#f4f4f5",
          color: "#18181b",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            margin: "0 16px",
            padding: "40px 32px",
            borderRadius: 24,
            border: "1px solid #e4e4e7",
            background: "#ffffff",
            textAlign: "center",
            boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>Hệ thống đang gặp sự cố</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#71717a", margin: "0 0 20px" }}>
            Trang không thể tải được. Vui lòng thử lại — nếu vẫn không được, hãy báo cho quản trị hệ thống.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, fontFamily: "monospace", color: "#a1a1aa", margin: "0 0 20px" }}>
              Mã lỗi: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: 999,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 500,
              color: "#ffffff",
              background: "#18181b",
            }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
