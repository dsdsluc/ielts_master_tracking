"use client";

import { Toast } from "@base-ui/react/toast";

/** Gọi bên trong cây component nằm dưới <ToastProvider> (đã bọc ở layout (app)). */
export function useToast() {
  const manager = Toast.useToastManager();

  return {
    toast: {
      success: (description: string, title = "Thành công") => manager.add({ type: "success", title, description, timeout: 4000 }),
      error: (description: string, title = "Có lỗi xảy ra") => manager.add({ type: "error", title, description, timeout: 6000 }),
      info: (description: string, title?: string) => manager.add({ type: "info", title, description, timeout: 4000 }),
    },
  };
}
