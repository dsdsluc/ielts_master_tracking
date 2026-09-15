import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ToastProvider, Toaster } from "@/components/ui/toast";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { getCurrentUser } from "@/lib/auth/dal";

const MAIN_SCROLL_ID = "app-main-scroll";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <ToastProvider>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar user={user} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <TopBar user={user} />
            <main id={MAIN_SCROLL_ID} className="flex-1 overflow-y-auto">
              <div className="px-5 py-6 lg:px-8">{children}</div>
            </main>
          </div>
        </div>
        <ScrollToTopButton scrollContainerId={MAIN_SCROLL_ID} />
      </SidebarProvider>
      <Toaster />
    </ToastProvider>
  );
}
