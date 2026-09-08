"use client";

import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";

/** Uncontrolled password input (name-based, for a native <form action=...>)
 * with a show/hide toggle and a Caps Lock warning. */
export function AuthPasswordField({
  id,
  name,
  label,
  autoComplete,
  placeholder,
  required = true,
  labelExtra,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  placeholder?: string;
  required?: boolean;
  labelExtra?: React.ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {labelExtra}
      </div>
      <div className="group relative">
        <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          onKeyUp={(e) => setCapsLockOn(e.getModifierState("CapsLock"))}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-xl border border-border bg-background pr-11 pl-10.5 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {capsLockOn && (
        <p className="flex items-center gap-1.5 text-xs text-status-spam">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Phím Caps Lock đang bật
        </p>
      )}
    </div>
  );
}
