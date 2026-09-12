"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, LoaderCircle, Send, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormMessage } from "@/components/form-message";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/api-client";
import { STUDENT_STAGE, STUDENT_STAGE_VALUES } from "@/lib/interactions/constants";
import { saveStudentProfile, addStudentCareLog } from "@/app/(app)/students/actions";
import { StageBadge } from "@/app/(app)/students/stage-badge";
import { TransferDialog } from "@/app/(app)/students/[id]/transfer-dialog";

const APPOINTMENT_STAGES: string[] = [STUDENT_STAGE.TEST_SCHEDULED, STUDENT_STAGE.TRIAL_SCHEDULED];

type CareLog = {
  id: string;
  loggedAt: string;
  loggedByName: string;
  content: string;
  stageAtLogTime: string | null;
};

type ProfileFormValues = {
  studentName: string;
  age: string;
  dateOfBirth: string;
  gender: string;
  parentName: string;
  phone: string;
  address: string;
  level: string;
  trainingTrack: string;
  school: string;
  aspiration: string;
  note: string;
};

export function StudentProfileView({
  profile,
  canEdit,
  canTransfer,
  currentAssignedEmail,
}: {
  profile: {
    id: string;
    studentName: string;
    age: number | null;
    dateOfBirth: string | null;
    gender: string | null;
    parentName: string | null;
    phone: string;
    address: string | null;
    level: string | null;
    trainingTrack: string | null;
    school: string | null;
    aspiration: string | null;
    stage: string | null;
    stageReason: string | null;
    caseDeadline: string | null;
    needsLeaderSupport: boolean;
    appointmentAt: string | null;
    note: string | null;
    channelName: string | null;
    conversationLink: string | null;
    careLogs: CareLog[];
  };
  canEdit: boolean;
  canTransfer: boolean;
  currentAssignedEmail: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [transferOpen, setTransferOpen] = useState(false);

  const [form, setForm] = useState<ProfileFormValues>({
    studentName: profile.studentName,
    age: profile.age?.toString() ?? "",
    dateOfBirth: profile.dateOfBirth ?? "",
    gender: profile.gender ?? "",
    parentName: profile.parentName ?? "",
    phone: profile.phone,
    address: profile.address ?? "",
    level: profile.level ?? "",
    trainingTrack: profile.trainingTrack ?? "",
    school: profile.school ?? "",
    aspiration: profile.aspiration ?? "",
    note: profile.note ?? "",
  });
  const [stage, setStage] = useState(profile.stage ?? "");
  const [stageReason, setStageReason] = useState(profile.stageReason ?? "");
  const [caseDeadline, setCaseDeadline] = useState(profile.caseDeadline ?? "");
  const [needsLeaderSupport, setNeedsLeaderSupport] = useState(profile.needsLeaderSupport);
  const [appointmentAt, setAppointmentAt] = useState(profile.appointmentAt ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [logContent, setLogContent] = useState("");
  const [savingLog, setSavingLog] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  function update<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileError(null);
    try {
      await saveStudentProfile(profile.id, {
        studentName: form.studentName,
        age: form.age ? Number(form.age) : null,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth) : null,
        gender: form.gender || null,
        parentName: form.parentName || null,
        address: form.address || null,
        level: form.level || null,
        trainingTrack: form.trainingTrack || null,
        school: form.school || null,
        aspiration: form.aspiration || null,
        note: form.note || null,
        stage: stage || null,
        stageReason: stageReason || null,
        caseDeadline: caseDeadline ? new Date(caseDeadline) : null,
        needsLeaderSupport,
        appointmentAt: appointmentAt ? new Date(appointmentAt) : null,
      });
      toast.success("Đã lưu hồ sơ học viên.");
      router.refresh();
    } catch (err) {
      setProfileError(apiErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAddLog() {
    if (!logContent.trim()) return;
    setSavingLog(true);
    setLogError(null);
    try {
      await addStudentCareLog(profile.id, logContent);
      setLogContent("");
      toast.success("Đã thêm nhật ký chăm sóc.");
      router.refresh();
    } catch (err) {
      setLogError(apiErrorMessage(err));
    } finally {
      setSavingLog(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="shadow-bubble flex flex-col gap-6 rounded-2xl border border-border/70 bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tiến trình hiện tại:</span>
            <StageBadge stage={profile.stage} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {profile.channelName && (
              <span className="text-xs text-muted-foreground">Kênh: {profile.channelName}</span>
            )}
            {profile.conversationLink && (
              <a
                href={profile.conversationLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-medium text-status-received hover:underline"
              >
                <ExternalLink className="size-3" /> Xem hội thoại gốc
              </a>
            )}
            {canTransfer && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-border bg-secondary/50 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => setTransferOpen(true)}
              >
                <UserCog className="size-3.5" />
                Chuyển giao học viên
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Tên học viên</Label>
            <Input value={form.studentName} onChange={(e) => update("studentName", e.target.value)} disabled={!canEdit} className="h-10 rounded-xl bg-secondary/40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Số điện thoại</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} disabled className="h-10 rounded-xl bg-secondary/40 font-mono" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Độ tuổi</Label>
            <Input type="number" value={form.age} onChange={(e) => update("age", e.target.value)} disabled={!canEdit} className="h-10 rounded-xl bg-secondary/40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Ngày sinh</Label>
            <Input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} disabled={!canEdit} className="h-10 rounded-xl bg-secondary/40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Giới tính</Label>
            <Input value={form.gender} onChange={(e) => update("gender", e.target.value)} disabled={!canEdit} className="h-10 rounded-xl bg-secondary/40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tên phụ huynh</Label>
            <Input value={form.parentName} onChange={(e) => update("parentName", e.target.value)} disabled={!canEdit} className="h-10 rounded-xl bg-secondary/40" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Địa chỉ</Label>
            <Input value={form.address} onChange={(e) => update("address", e.target.value)} disabled={!canEdit} className="h-10 rounded-xl bg-secondary/40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Trình độ</Label>
            <Input value={form.level} onChange={(e) => update("level", e.target.value)} disabled={!canEdit} className="h-10 rounded-xl bg-secondary/40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Hệ đào tạo</Label>
            <Input value={form.trainingTrack} onChange={(e) => update("trainingTrack", e.target.value)} disabled={!canEdit} className="h-10 rounded-xl bg-secondary/40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Trường học</Label>
            <Input value={form.school} onChange={(e) => update("school", e.target.value)} disabled={!canEdit} className="h-10 rounded-xl bg-secondary/40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Nguyện vọng</Label>
            <Input value={form.aspiration} onChange={(e) => update("aspiration", e.target.value)} disabled={!canEdit} className="h-10 rounded-xl bg-secondary/40" />
          </div>
        </div>

        <div className="h-px bg-border/60" />

        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Tiến trình tư vấn</Label>
            <Select value={stage} onValueChange={(v) => setStage(v ?? "")} disabled={!canEdit}>
              <SelectTrigger className="h-10 w-full rounded-xl bg-background">
                <SelectValue placeholder="Chưa gọi" />
              </SelectTrigger>
              <SelectContent>
                {STUDENT_STAGE_VALUES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Lý do (nếu có)</Label>
            <Input
              value={stageReason}
              onChange={(e) => setStageReason(e.target.value)}
              disabled={!canEdit}
              placeholder="Vd: không đến test, do mức giá, do giáo viên..."
              className="h-10 rounded-xl bg-secondary/40"
            />
          </div>
          {APPOINTMENT_STAGES.includes(stage) && (
            <div className="flex flex-col gap-1.5">
              <Label>Ngày hẹn cụ thể</Label>
              <Input
                type="date"
                value={appointmentAt}
                onChange={(e) => setAppointmentAt(e.target.value)}
                disabled={!canEdit}
                className="h-10 rounded-xl bg-secondary/40"
              />
            </div>
          )}
        </div>

        {stageReason.trim() && (
          <div className="flex flex-col gap-3 rounded-xl border border-status-received/30 bg-status-received-bg/20 p-4">
            <p className="font-condensed text-[10px] font-semibold tracking-wide text-status-received uppercase">Case đang kẹt</p>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Deadline xử lý tiếp theo</Label>
                <Input
                  type="date"
                  value={caseDeadline}
                  onChange={(e) => setCaseDeadline(e.target.value)}
                  disabled={!canEdit}
                  className="h-10 rounded-xl bg-background"
                />
              </div>
              <div className="flex items-center gap-2 self-end pb-2.5">
                <Checkbox
                  id="needs-leader-support"
                  checked={needsLeaderSupport}
                  onCheckedChange={(c) => setNeedsLeaderSupport(c === true)}
                  disabled={!canEdit}
                />
                <Label htmlFor="needs-leader-support" className="cursor-pointer font-normal">
                  Cần Leader hỗ trợ can thiệp case này
                </Label>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>Ghi chú chung</Label>
          <Textarea value={form.note} onChange={(e) => update("note", e.target.value)} disabled={!canEdit} className="min-h-20 rounded-xl" />
        </div>

        {profileError && <FormMessage kind="error">{profileError}</FormMessage>}

        {canEdit && (
          <div className="flex justify-end">
            <Button
              type="button"
              className="glossy shadow-bubble rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90"
              disabled={savingProfile}
              onClick={handleSaveProfile}
            >
              {savingProfile && <LoaderCircle className="animate-spin" />}
              Lưu hồ sơ
            </Button>
          </div>
        )}
      </div>

      <div className="shadow-bubble flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-6">
        <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Nhật ký chăm sóc</h2>

        {canEdit && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Textarea
              value={logContent}
              onChange={(e) => setLogContent(e.target.value)}
              placeholder="Ghi lại nội dung cuộc gọi vừa thực hiện..."
              className="min-h-16 flex-1 rounded-xl"
            />
            <Button
              type="button"
              className="glossy shadow-bubble h-10 rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90"
              disabled={savingLog || !logContent.trim()}
              onClick={handleAddLog}
            >
              {savingLog ? <LoaderCircle className="animate-spin" /> : <Send className="size-4" />}
              Ghi nhận
            </Button>
          </div>
        )}
        {logError && <FormMessage kind="error">{logError}</FormMessage>}

        {profile.careLogs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chưa có nhật ký chăm sóc nào.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {profile.careLogs.map((log) => (
              <div key={log.id} className="flex flex-col gap-1 rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{log.loggedByName}</span>
                  <span>·</span>
                  <span>{new Date(log.loggedAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  {log.stageAtLogTime && (
                    <>
                      <span>·</span>
                      <StageBadge stage={log.stageAtLogTime} />
                    </>
                  )}
                </div>
                <p className="text-sm text-foreground">{log.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {canTransfer && (
        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          studentProfileId={profile.id}
          currentAssignedEmail={currentAssignedEmail}
          onDone={() => router.refresh()}
        />
      )}
    </div>
  );
}
