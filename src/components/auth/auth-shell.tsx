"use client";

import { motion } from "motion/react";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

/** Outer chrome for /login: a centered split card (brand panel + form) with
 * an entrance animation. The form itself is passed in as children. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/60 bg-linear-to-br from-secondary/70 via-background to-background sm:rounded-[2.75rem] lg:grid-cols-[1.05fr_1fr]"
    >
      <AuthBrandPanel />

      <div className="relative flex flex-col justify-center border-t border-border/60 bg-card/40 px-10 py-12 sm:px-12 sm:py-14 lg:border-t-0 lg:border-l">
        {children}
      </div>
    </motion.div>
  );
}
