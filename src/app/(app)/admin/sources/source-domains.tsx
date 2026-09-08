"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addSourceDomain, removeSourceDomain } from "@/app/(app)/admin/sources/actions";

export function SourceDomains({ sourceName, domains }: { sourceName: string; domains: { id: number; domain: string }[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await addSourceDomain(sourceName, value);
      setValue("");
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thêm được.");
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(id: number) {
    setRemovingId(id);
    try {
      await removeSourceDomain(id);
      router.refresh();
    } catch {
      setRemovingId(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {domains.length === 0 && !adding && <span className="text-xs text-muted-foreground">Chưa có domain</span>}
      {domains.map((d) => (
        <span key={d.id} className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 py-0.5 pr-1 pl-2 font-mono text-xs text-foreground">
          {d.domain}
          <button
            type="button"
            onClick={() => handleRemove(d.id)}
            disabled={removingId === d.id}
            className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Xoá domain ${d.domain}`}
          >
            {removingId === d.id ? <LoaderCircle className="size-3 animate-spin" /> : <X className="size-3" />}
          </button>
        </span>
      ))}
      {adding ? (
        <form onSubmit={handleAdd} className="flex items-center gap-1">
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="facebook.com"
            className="h-7 w-32 rounded-full px-2.5 text-xs"
          />
          <Button type="submit" size="icon-xs" className="rounded-full" disabled={pending}>
            {pending ? <LoaderCircle className="size-3 animate-spin" /> : <Plus className="size-3" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="rounded-full"
            onClick={() => {
              setAdding(false);
              setValue("");
              setError(null);
            }}
          >
            <X className="size-3" />
          </Button>
        </form>
      ) : (
        <Button type="button" variant="ghost" size="icon-xs" className="rounded-full text-muted-foreground" onClick={() => setAdding(true)} aria-label="Thêm domain">
          <Plus className="size-3" />
        </Button>
      )}
      {error && <span className="w-full text-xs text-destructive">{error}</span>}
    </div>
  );
}
