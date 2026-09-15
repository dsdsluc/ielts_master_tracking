import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/status-pill";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import {
  getLatestSpamReason,
  spamReasonLabel,
} from "@/app/(app)/admin/spam-reason";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">
        {value || "—"}
      </span>
    </div>
  );
}

export default async function SpamReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(ROLES.ADMIN);
  const { id } = await params;

  const interaction = await prisma.interaction.findUnique({
    where: { interactionId: id },
    select: {
      interactionId: true,
      customerName: true,
      statusName: true,
      fanpageName: true,
      sourceName: true,
      assignedBranchCode: true,
      touchCount: true,
      closedAt: true,
      conversationLink: true,
      assignedBranch: { select: { name: true } },
      updatedBy: { select: { fullName: true, email: true } },
    },
  });
  if (!interaction) notFound();

  const reason = await getLatestSpamReason(id);

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/admin/monitoring" />}
          aria-label="Quay lại Trung tâm quản trị"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col gap-0.5">
          <span className="font-condensed text-xs font-semibold tracking-wide text-primary uppercase">
            Quản trị · Đóng Spam
          </span>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            {interaction.customerName}
          </h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Thông tin liên hệ</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field
              label="Trạng thái"
              value={<StatusPill status={interaction.statusName} />}
            />
            <Field
              label="Cơ sở"
              value={
                interaction.assignedBranch?.name ??
                interaction.assignedBranchCode
              }
            />
            <Field label="Fanpage" value={interaction.fanpageName} />
            <Field label="Nguồn" value={interaction.sourceName} />
            <Field label="Lần chăm sóc" value={interaction.touchCount} />
            <Field
              label="Đóng lúc"
              value={
                interaction.closedAt
                  ? formatDateTime(interaction.closedAt.toISOString())
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ai đóng & vì sao</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Người đóng" value={interaction.updatedBy?.fullName} />
            <Field label="Email" value={interaction.updatedBy?.email} />
            <div className="col-span-2">
              <Field
                label="Lý do đóng Spam"
                value={spamReasonLabel(reason?.code ?? null)}
              />
            </div>
            <div className="col-span-2">
              <Field label="Ghi chú" value={reason?.note} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        {interaction.conversationLink ? (
          <Button
            variant="outline"
            className="rounded-full"
            nativeButton={false}
            render={
              <a
                href={interaction.conversationLink}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            <MessageCircle className="size-4" />
            Mở cuộc hội thoại — xem tại sao đóng Spam
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Chưa có link cuộc hội thoại cho liên hệ này.
          </p>
        )}
      </div>
    </>
  );
}
