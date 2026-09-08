"use client";

import { useActionState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthIconField } from "@/components/auth/auth-icon-field";
import { AuthPasswordField } from "@/components/auth/auth-password-field";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { login } from "@/app/(auth)/login/actions";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <AuthShell>
      <motion.div
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
        className="mx-auto w-full max-w-sm"
      >
        <motion.div variants={fadeUp} transition={{ duration: 0.5 }} className="mb-9">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
            Đăng nhập
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Nhập email và mật khẩu tài khoản nội bộ của bạn.
          </p>
        </motion.div>

        <form action={formAction} className="flex flex-col gap-5">
          <motion.div variants={fadeUp} transition={{ duration: 0.5 }}>
            <AuthIconField
              id="email"
              name="email"
              label="Email"
              icon={Mail}
              type="email"
              placeholder="ten@ieltsmaster.vn"
              autoComplete="email"
            />
          </motion.div>

          <motion.div variants={fadeUp} transition={{ duration: 0.5 }}>
            <AuthPasswordField
              id="password"
              name="password"
              label="Mật khẩu"
              autoComplete="current-password"
            />
          </motion.div>

          {state?.error && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
              <FormMessage kind="error" className="rounded-lg bg-destructive/10 px-3 py-2.5">
                {state.error}
              </FormMessage>
            </motion.div>
          )}

          <motion.div variants={fadeUp} transition={{ duration: 0.5 }}>
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="glossy shadow-bubble group mt-1 h-12 w-full rounded-full text-base transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {pending ? "Đang đăng nhập…" : "Đăng nhập"}
              {!pending && (
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  data-icon="inline-end"
                />
              )}
            </Button>
          </motion.div>
        </form>

        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          initial="hidden"
          animate="show"
          className="mt-8 flex items-center gap-3 text-xs text-muted-foreground/80"
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <p className="leading-relaxed">
            Chỉ tài khoản nội bộ đã được cấp mới truy cập được dữ liệu liên hệ.
          </p>
        </motion.div>
      </motion.div>
    </AuthShell>
  );
}
