import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const fontUI = IBM_Plex_Sans({
  variable: "--font-ui",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

const fontCondensed = IBM_Plex_Sans_Condensed({
  variable: "--font-condensed",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
});

const fontData = IBM_Plex_Mono({
  variable: "--font-data",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Theo dõi Liên hệ · IELTS Master",
  description: "Hệ thống theo dõi và chăm sóc liên hệ nội bộ IELTS Master.",
};

// Đọc theme đã lưu (hoặc prefers-color-scheme lần đầu) và gắn class .dark
// TRƯỚC khi React hydrate — tránh nháy sai giao diện lúc tải trang. Đặt
// suppressHydrationWarning ở <html> vì class này chỉ được gắn phía client.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${fontUI.variable} ${fontCondensed.variable} ${fontData.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider delay={200}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
