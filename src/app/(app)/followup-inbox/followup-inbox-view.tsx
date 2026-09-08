"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import { resolveFollowup } from "@/app/(app)/leads/leads-api";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { useToast } from "@/hooks/use-toast";

export type FollowupInboxItem = {
  interactionId: string;
  customerName: string;
  status: string;
  branchName: string;
  mktSuggestion: string | null;
  mktPushedAt: string;
  mktPushedByName: string | null;
};

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function FollowupCard({ item, onResolved }: { item: FollowupInboxItem; onResolved: (id: string) => void }) {
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleResolve() {
    setPending(true);
    try {
      await resolveFollowup(item.interactionId);
      toast.success("Đã đánh dấu xử lý xong.");
      onResolved(item.interactionId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không xử lý được.");
    } finally {
      setPending(false);
    }
  }

  const idle = daysSince(item.mktPushedAt);

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-accent bg-accent/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{item.customerName}</span>
          <StatusPill status={item.status} />
          <span className="text-xs text-muted-foreground">{item.branchName}</span>
        </div>
        <p className="flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-accent-foreground uppercase">
          <Sparkles className="size-3.5" /> Cần chăm sóc lại
        </p>
      </div>

      {item.mktSuggestion && <p className="text-sm text-foreground">{item.mktSuggestion}</p>}

      <p className="text-xs text-muted-foreground">
        {item.mktPushedByName ? `${item.mktPushedByName} yêu cầu lúc ` : "Yêu cầu lúc "}
        {formatDateTime(item.mktPushedAt)}
        {idle > 0 && ` · ${idle} ngày trước`}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="w-fit rounded-full border border-gold/30 bg-accent px-4 text-accent-foreground hover:bg-accent/80"
          onClick={handleResolve}
          disabled={pending}
        >
          {pending && <LoaderCircle className="animate-spin" />}
          Đánh dấu đã xử lý
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="w-fit rounded-full text-muted-foreground hover:text-foreground"
          nativeButton={false}
          render={<Link href={`/leads/${item.interactionId}`} />}
        >
          Mở liên hệ
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function FollowupInboxView({ items }: { items: FollowupInboxItem[] }) {
  const router = useRouter();
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const visible = items.filter((i) => !resolvedIds.has(i.interactionId));

  function handleResolved(id: string) {
    setResolvedIds((prev) => new Set(prev).add(id));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {visible.map((item) => (
        <FollowupCard key={item.interactionId} item={item} onResolved={handleResolved} />
      ))}
    </div>
  );
}
