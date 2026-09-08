"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { CheckCircle2, CircleAlert, Info, Loader2, X } from "lucide-react"
import { cn } from "cn"

const ToastProvider = ToastPrimitive.Provider

const TOAST_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: CircleAlert,
  loading: Loader2,
  info: Info,
}

const TOAST_ICON_STYLES: Record<string, string> = {
  success: "text-status-qualified",
  error: "text-destructive",
  loading: "animate-spin text-muted-foreground",
  info: "text-status-received",
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        "fixed top-auto right-4 bottom-4 z-100 mx-auto flex w-[min(24rem,calc(100vw-2rem))] flex-col outline-none sm:right-6 sm:bottom-6",
        className
      )}
      {...props}
    />
  )
}

function Toaster() {
  const { toasts } = ToastPrimitive.useToastManager()
  return (
    <ToastPrimitive.Portal>
      <ToastViewport>
        {toasts.map((toast) => {
          const Icon = TOAST_ICONS[toast.type ?? "info"] ?? Info
          return (
            <ToastPrimitive.Root
              key={toast.id}
              toast={toast}
              data-slot="toast"
              className={cn(
                "shadow-bubble absolute right-0 bottom-0 left-0 z-[calc(100-var(--toast-index))] mt-2 flex items-start gap-2.5 rounded-2xl border border-border bg-card p-4 text-sm text-card-foreground select-none",
                "transition-all duration-300",
                "data-[starting-style]:translate-y-4 data-[starting-style]:opacity-0",
                "data-[ending-style]:translate-y-4 data-[ending-style]:opacity-0",
                "data-[limited]:opacity-0",
                "[transform:translateY(calc(var(--toast-offset-y)*-1))_scale(var(--toast-scale))]"
              )}
              style={{ transitionProperty: "transform, opacity" }}
            >
              <span className={cn("mt-0.5 flex shrink-0 items-center justify-center", TOAST_ICON_STYLES[toast.type ?? "info"])}>
                <Icon className="size-4.5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {toast.title && (
                  <ToastPrimitive.Title data-slot="toast-title" className="font-medium text-foreground">
                    {toast.title}
                  </ToastPrimitive.Title>
                )}
                {toast.description && (
                  <ToastPrimitive.Description data-slot="toast-description" className="text-muted-foreground">
                    {toast.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close
                data-slot="toast-close"
                aria-label="Đóng"
                className="-mt-0.5 -mr-1 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          )
        })}
      </ToastViewport>
    </ToastPrimitive.Portal>
  )
}

export { ToastProvider, Toaster }
