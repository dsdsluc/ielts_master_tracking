"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, History, LoaderCircle, PhoneCall, TriangleAlert, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { FormMessage } from "@/components/form-message";
import { StatusPill } from "@/components/status-pill";
import { CopyButton } from "@/components/copy-button";
import { InfoRow } from "@/app/(app)/leads/info-row";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { CUSTOMER_STAGE_VALUES } from "@/lib/interactions/constants";
import { updateCustomerProfile, updateCustomerStage, logCustomerCare, transferCustomer, type CustomerDetail } from "@/app/(app)/customers/customers-api";
import { AssignCustomerDialog } from "@/app/(app)/customer-assignment/assign-customer-dialog";
import { useToast } from "@/hooks/use-toast";

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function CustomerProfileView({ detail, canManageAssignment }: { detail: CustomerDetail; canManageAssignment: boolean }) {
  const router = useRouter();
  const { toast } = useToast();

  const [profile, setProfile] = useState({
    displayName: detail.displayName,
    phoneNormalized: detail.phoneNormalized ?? "",
    age: detail.age?.toString() ?? "",
    dateOfBirth: toDateInputValue(detail.dateOfBirth),
    gender: detail.gender ?? "",
    parentName: detail.parentName ?? "",
    address: detail.address ?? "",
    level: detail.level ?? "",
    trainingTrack: detail.trainingTrack ?? "",
    school: detail.school ?? "",
    aspiration: detail.aspiration ?? "",
    note: detail.note ?? "",
  });
  const [profilePending, setProfilePending] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [stageForm, setStageForm] = useState({
    stage: detail.stage ?? "",
    stageReason: detail.stageReason ?? "",
    appointmentAt: toDateInputValue(detail.appointmentAt),
    caseDeadline: toDateInputValue(detail.caseDeadline),
    needsLeaderSupport: detail.needsLeaderSupport,
  });
  const [stagePending, setStagePending] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  const [careContent, setCareContent] = useState("");
  const [carePending, setCarePending] = useState(false);
  const [careError, setCareError] = useState<string | null>(null);

  const [transferOpen, setTransferOpen] = useState(false);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setProfilePending(true);
    try {
      await updateCustomerProfile(detail.customerKey, {
        displayName: profile.displayName,
        phoneNormalized: profile.phoneNormalized || null,
        age: profile.age ? Number(profile.age) : null,
        dateOfBirth: profile.dateOfBirth ? new Date(profile.dateOfBirth) : null,
        gender: profile.gender || null,
        parentName: profile.parentName || null,
        address: profile.address || null,
        level: profile.level || null,
        trainingTrack: profile.trainingTrack || null,
        school: profile.school || null,
        aspiration: profile.aspiration || null,
        note: profile.note || null,
      });
      toast.success("Đã lưu hồ sơ.");
      router.refresh();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setProfilePending(false);
    }
  }

  async function handleSaveStage(e: React.FormEvent) {
    e.preventDefault();
    if (!stageForm.stage) return;
    setStageError(null);
    setStagePending(true);
    try {
      await updateCustomerStage(detail.customerKey, {
        stage: stageForm.stage,
        stageReason: stageForm.stageReason || null,
        appointmentAt: stageForm.appointmentAt ? new Date(stageForm.appointmentAt) : null,
        caseDeadline: stageForm.caseDeadline ? new Date(stageForm.caseDeadline) : null,
        needsLeaderSupport: stageForm.needsLeaderSupport,
      });
      toast.success("Đã cập nhật tư vấn ghi danh.");
      router.refresh();
    } catch (err) {
      setStageError(err instanceof Error ? err.message : "Không cập nhật được.");
    } finally {
      setStagePending(false);
    }
  }

  async function handleAddCareLog(e: React.FormEvent) {
    e.preventDefault();
    if (!careContent.trim()) return;
    setCareError(null);
    setCarePending(true);
    try {
      await logCustomerCare(detail.customerKey, careContent.trim());
      setCareContent("");
      toast.success("Đã ghi nhận chăm sóc.");
      router.refresh();
    } catch (err) {
      setCareError(err instanceof Error ? err.message : "Không ghi được.");
    } finally {
      setCarePending(false);
    }
  }

  async function handleTransfer(targetEmail: string) {
    await transferCustomer(detail.customerKey, targetEmail);
    toast.success("Đã điều chuyển khách hàng.");
    router.refresh();
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="icon-sm" className="rounded-full" nativeButton={false} render={<Link href="/customers" />} aria-label="Quay lại Khách hàng">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col gap-0.5">
          <span className="font-condensed text-xs font-semibold tracking-wide text-primary uppercase">Vận hành · Khách hàng</span>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-semibold text-foreground">{detail.displayName}</h1>
            <StatusPill status={detail.currentStatusName} />
            {detail.needsLeaderSupport && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                <TriangleAlert className="size-3.5" /> Cần Leader hỗ trợ
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <form onSubmit={handleSaveProfile} className="shadow-bubble flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Hồ sơ tư vấn</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="displayName">Tên khách hàng</Label>
                <Input id="displayName" value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phoneNormalized">SĐT</Label>
                <Input id="phoneNormalized" value={profile.phoneNormalized} onChange={(e) => setProfile({ ...profile, phoneNormalized: e.target.value })} className="font-mono" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="age">Tuổi</Label>
                <Input id="age" type="number" min={0} value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dateOfBirth">Ngày sinh</Label>
                <Input id="dateOfBirth" type="date" value={profile.dateOfBirth} onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="gender">Giới tính</Label>
                <Input id="gender" value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="parentName">Tên phụ huynh</Label>
                <Input id="parentName" value={profile.parentName} onChange={(e) => setProfile({ ...profile, parentName: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="level">Trình độ hiện tại</Label>
                <Input id="level" value={profile.level} onChange={(e) => setProfile({ ...profile, level: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="trainingTrack">Lộ trình quan tâm</Label>
                <Input id="trainingTrack" value={profile.trainingTrack} onChange={(e) => setProfile({ ...profile, trainingTrack: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="school">Trường</Label>
                <Input id="school" value={profile.school} onChange={(e) => setProfile({ ...profile, school: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="address">Địa chỉ</Label>
                <Input id="address" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aspiration">Nguyện vọng</Label>
              <Textarea id="aspiration" value={profile.aspiration} onChange={(e) => setProfile({ ...profile, aspiration: e.target.value })} className="min-h-16" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Ghi chú</Label>
              <Textarea id="note" value={profile.note} onChange={(e) => setProfile({ ...profile, note: e.target.value })} className="min-h-16" />
            </div>
            {profileError && <FormMessage kind="error">{profileError}</FormMessage>}
            <Button type="submit" size="sm" className="w-fit rounded-full" disabled={profilePending}>
              {profilePending && <LoaderCircle className="animate-spin" />}
              Lưu hồ sơ
            </Button>
          </form>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <History className="size-3.5" /> Lịch sử chăm sóc
            </p>
            <form onSubmit={handleAddCareLog} className="mb-4 flex flex-col gap-2">
              <Textarea
                value={careContent}
                onChange={(e) => setCareContent(e.target.value)}
                placeholder="Ghi lại nội dung cuộc gọi/tương tác với khách…"
                className="min-h-20"
              />
              {careError && <FormMessage kind="error">{careError}</FormMessage>}
              <Button type="submit" size="sm" className="w-fit rounded-full" disabled={carePending || !careContent.trim()}>
                {carePending && <LoaderCircle className="animate-spin" />}
                Ghi nhận chăm sóc
              </Button>
            </form>
            <Separator className="mb-4" />
            {detail.careLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có lượt chăm sóc nào.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {detail.careLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-border/70 bg-secondary/20 px-3 py-2.5 text-sm">
                    <p className="whitespace-pre-line text-foreground">{log.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.loggedByName} · {formatDateTime(log.loggedAt)}
                      {log.stageAtLogTime && <> · {log.stageAtLogTime}</>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Phân bổ</h2>
            <InfoRow label="Tư vấn viên" value={detail.assignedToName ?? "Chưa gán"} />
            {detail.assignedByName && <InfoRow label="Phân bổ bởi" value={detail.assignedByName} />}
            {detail.assignedAt && <InfoRow label="Ngày phân bổ" value={formatDateTime(detail.assignedAt)} />}
            <InfoRow
              label="SĐT"
              value={
                detail.phoneNormalized ? (
                  <span className="flex items-center justify-end gap-1.5 font-mono">
                    <PhoneCall className="size-3.5" />
                    {detail.phoneNormalized}
                    <CopyButton value={detail.phoneNormalized} label="Đã copy số điện thoại" />
                  </span>
                ) : (
                  "Chưa có"
                )
              }
            />
            {canManageAssignment && (
              <Button variant="outline" size="sm" className="mt-3 w-full rounded-full" onClick={() => setTransferOpen(true)}>
                <UserCog className="size-3.5" /> Điều chuyển Sale khác
              </Button>
            )}
          </div>

          <form onSubmit={handleSaveStage} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Tư vấn ghi danh</h2>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stage">Mốc hiện tại</Label>
              <Select value={stageForm.stage} onValueChange={(v) => setStageForm({ ...stageForm, stage: v ?? "" })}>
                <SelectTrigger id="stage" className="h-10 w-full rounded-lg bg-background">
                  <SelectValue placeholder="Chưa gọi" />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_STAGE_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stageReason">Lý do (nếu kẹt)</Label>
              <Input id="stageReason" value={stageForm.stageReason} onChange={(e) => setStageForm({ ...stageForm, stageReason: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appointmentAt">Ngày hẹn</Label>
              <Input id="appointmentAt" type="date" value={stageForm.appointmentAt} onChange={(e) => setStageForm({ ...stageForm, appointmentAt: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="caseDeadline">Hạn xử lý tiếp theo</Label>
              <Input id="caseDeadline" type="date" value={stageForm.caseDeadline} onChange={(e) => setStageForm({ ...stageForm, caseDeadline: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={stageForm.needsLeaderSupport} onCheckedChange={(v) => setStageForm({ ...stageForm, needsLeaderSupport: !!v })} />
              Cần Leader hỗ trợ (khách kẹt)
            </label>
            {detail.enrolledAt && <p className="text-xs text-status-qualified">Đã chốt lúc {formatDateTime(detail.enrolledAt)}</p>}
            {stageError && <FormMessage kind="error">{stageError}</FormMessage>}
            <Button type="submit" size="sm" className="w-fit rounded-full" disabled={stagePending || !stageForm.stage}>
              {stagePending && <LoaderCircle className="animate-spin" />}
              Lưu tư vấn ghi danh
            </Button>
          </form>
        </div>
      </div>

      <AssignCustomerDialog open={transferOpen} onOpenChange={setTransferOpen} selectedCount={1} onConfirm={handleTransfer} />
    </>
  );
}
