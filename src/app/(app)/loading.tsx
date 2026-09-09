import { AppLoadingScreen } from "@/components/layout/app-loading-screen";

// File này là quy ước của Next.js — mọi trang trong nhóm (app) (Sidebar/TopBar
// vẫn giữ nguyên, chỉ vùng nội dung này bị thay) đều tự dùng chung file này
// làm màn hình chờ trong lúc Server Component của trang đích đang tải dữ liệu.
export default function AppLoading() {
  return <AppLoadingScreen />;
}
