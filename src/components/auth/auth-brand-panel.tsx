"use client";

import { motion } from "motion/react";
import { AuthPipelineStrip } from "@/components/auth/auth-pipeline-strip";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

const TRUST_PILLS = ["Dữ liệu nội bộ", "Phân quyền theo cơ sở", "Nhật ký thao tác đầy đủ"];

/** Left column of the login screen — copy + the pipeline strip signature.
 * Structure borrowed from the sibling Fundas project's auth screens
 * (gradient glow, staggered fade-up, trust pills, glossy stat card);
 * copy and the signature visual are this product's own. */
export function AuthBrandPanel() {
  return (
    <div className="relative flex flex-col justify-between gap-12 overflow-hidden px-10 py-12 sm:px-12 sm:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-gold) 0%, transparent 70%)" }}
      />

      <motion.div
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.12, delayChildren: 0.05 }}
        className="relative min-w-0"
      >
        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.5 }}
          className="mb-5 font-condensed text-xs uppercase tracking-[0.3em] text-primary"
        >
          Theo dõi Liên hệ · IELTS Master
        </motion.p>
        <motion.h1
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="font-heading text-4xl leading-[1.1] font-semibold tracking-tight text-foreground sm:text-[2.75rem]"
        >
          Theo dõi liên hệ, chăm sóc đúng người, đúng lúc.
        </motion.h1>
        <motion.p
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="mt-5 max-w-sm text-base leading-relaxed text-muted-foreground"
        >
          Đăng nhập bằng email nội bộ để xem liên hệ đang chờ, khách đang được chăm sóc và hiệu suất từng cơ sở.
        </motion.p>

        <motion.div
          variants={fadeUp}
          transition={{ duration: 0.6 }}
          className="mt-8 flex flex-wrap gap-2.5"
        >
          {TRUST_PILLS.map((text) => (
            <span
              key={text}
              className="glossy rounded-full border border-border bg-card/80 px-3.5 py-1.5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase"
            >
              {text}
            </span>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45 }}
        className="relative"
      >
        <AuthPipelineStrip />
      </motion.div>
    </div>
  );
}
