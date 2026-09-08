"use client";

import type { LucideIcon } from "lucide-react";

/** Labeled, uncontrolled text input with a leading icon — plugs directly
 * into a native <form action={serverAction}> via `name`, no client state. */
export function AuthIconField({
  id,
  name,
  label,
  icon: Icon,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  icon: LucideIcon;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="group relative">
        <Icon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <input
          id={id}
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="h-12 w-full rounded-xl border border-border bg-background pr-3 pl-10.5 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
    </div>
  );
}
