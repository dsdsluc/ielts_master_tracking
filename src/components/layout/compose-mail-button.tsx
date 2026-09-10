"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Mail, Search, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/form-message";
import { useToast } from "@/hooks/use-toast";

type Member = { email: string; fullName: string; role: string; branchName: string | null };

export function ComposeMailButton() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || members.length > 0) return;
    setLoadingMembers(true);
    fetch("/api/admin/users/list", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => setMembers(data.users ?? []))
      .catch(() => toast.error("Không tải được danh sách thành viên."))
      .finally(() => setLoadingMembers(false));
  }, [open, members.length, toast]);

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("vi");
    if (!needle) return members;
    return members.filter((m) => [m.fullName, m.email, m.role].some((v) => v.toLocaleLowerCase("vi").includes(needle)));
  }, [members, search]);

  const allFilteredSelected = filteredMembers.length > 0 && filteredMembers.every((m) => selected.has(m.email));

  function toggleOne(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  // "Chọn tất cả" chỉ áp dụng cho các thành viên đang hiển thị (đã qua tìm
  // kiếm) — giống cơ chế chọn ở System Log/Chi phí quảng cáo.
  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const m of filteredMembers) next.delete(m.email);
      } else {
        for (const m of filteredMembers) next.add(m.email);
      }
      return next;
    });
  }

  function reset() {
    setSearch("");
    setSelected(new Set());
    setSubject("");
    setBody("");
    setError(null);
  }

  async function handleSend() {
    if (selected.size === 0 || !subject.trim() || !body.trim()) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/broadcast-email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), recipientEmails: [...selected] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? `Lỗi ${res.status}`);
      toast.success(`Đã gửi email cho ${data.sent} thành viên.`);
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được email.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Soạn email cho thành viên"
          />
        }
      >
        <Mail className="size-4" />
      </DialogTrigger>
      <DialogContent className="shadow-bubble flex h-[85vh] max-h-[calc(100vh-3rem)] w-full flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 gap-0 px-6 pt-6 pb-3">
          <DialogTitle>Soạn email cho thành viên</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Người nhận ({selected.size} đã chọn)</Label>
                {filteredMembers.length > 0 && (
                  <button type="button" onClick={toggleAllFiltered} className="text-xs font-medium text-status-received hover:underline">
                    {allFilteredSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm tên, email, vai trò…"
                  className="h-9 rounded-xl bg-background pr-3 pl-8 text-sm"
                />
              </div>
              <ScrollArea className="h-56 rounded-xl border border-border/70">
                {loadingMembers ? (
                  <div className="flex h-full items-center justify-center py-8">
                    <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">Không tìm thấy thành viên phù hợp.</p>
                ) : (
                  <div className="flex flex-col">
                    {filteredMembers.map((m) => {
                      const checked = selected.has(m.email);
                      return (
                        <label
                          key={m.email}
                          className={`flex cursor-pointer items-center gap-2.5 border-b border-border/40 px-3 py-2 last:border-0 hover:bg-secondary/40 ${checked ? "bg-accent/30" : ""}`}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleOne(m.email)} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{m.fullName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {m.email} · {m.role}
                              {m.branchName ? ` · ${m.branchName}` : ""}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="broadcast-subject">Tiêu đề</Label>
              <Input id="broadcast-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10 rounded-xl bg-background" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="broadcast-body">Nội dung</Label>
              <Textarea id="broadcast-body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-56 rounded-xl" />
            </div>

            {error && <FormMessage kind="error">{error}</FormMessage>}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-3xl border-t bg-muted/50 px-6 py-4">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)} disabled={pending}>
            Huỷ
          </Button>
          <Button
            type="button"
            className="glossy shadow-bubble rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90"
            disabled={pending || selected.size === 0 || !subject.trim() || !body.trim()}
            onClick={handleSend}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <Send className="size-4" />}
            Gửi ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
