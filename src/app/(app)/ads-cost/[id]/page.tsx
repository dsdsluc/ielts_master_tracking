import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { formatDate, formatVnd } from "@/app/(app)/ads-cost/format";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export default async function AdsCostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(ROLES.MARKETING, ROLES.ADMIN);
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const row = await prisma.adsCost.findUnique({
    where: { id },
    include: { source: true, fanpage: true, branch: true },
  });
  if (!row) notFound();

  const numberFmt = (n: number | null) => (n != null ? n.toLocaleString("vi-VN") : "—");

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="icon-sm" className="rounded-full" nativeButton={false} render={<Link href="/ads-cost" />} aria-label="Quay lại Chi phí quảng cáo">
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col gap-0.5">
          <span className="font-condensed text-xs font-semibold tracking-wide text-primary uppercase">Marketing · Chi phí quảng cáo</span>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{row.adName}</h1>
          <p className="font-mono text-xs text-muted-foreground">Ad ID: {row.adId}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          nativeButton={false}
          render={<Link href={`/ads-performance/${encodeURIComponent(row.adId)}`} />}
        >
          <TrendingUp className="size-4" />
          Xem hiệu suất tổng hợp (mọi kỳ) của Ad ID này
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Thông tin chung</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Kỳ báo cáo" value={`${formatDate(row.periodStart.toISOString())} – ${formatDate(row.periodEnd.toISOString())}`} />
            <Field label="Chi phí (VNĐ)" value={formatVnd(row.costVnd.toString())} />
            <Field label="Nguồn" value={row.source?.name} />
            <Field label="Fanpage" value={row.fanpage?.name} />
            <Field label="Cơ sở" value={row.branch?.name} />
            <Field label="Cập nhật lần cuối" value={`${formatDate(row.updatedAt.toISOString())}${row.updatedByEmail ? ` · ${row.updatedByEmail}` : ""}`} />
            <div className="col-span-2">
              <Field label="Ghi chú" value={row.note} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Từ report Facebook Ads Manager</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Chiến dịch (Campaign)" value={row.campaignName} />
            <Field label="Nhóm quảng cáo (Ad set)" value={row.adSetName} />
            <Field label="Loại nội dung (Media type)" value={row.mediaType} />
            <Field label="Loại kết quả (Result type)" value={row.resultType} />
            <Field label="Kết quả (Results)" value={numberFmt(row.results)} />
            <Field label="Kết quả ban đầu (Results initial)" value={numberFmt(row.resultsInitial)} />
            <Field label="Lượt hiển thị (Impressions)" value={numberFmt(row.impressions)} />
            <Field label="Lượt tương tác bài viết" value={numberFmt(row.postEngagements)} />
            <Field label="Lượt click link" value={numberFmt(row.linkClicks)} />
            <Field label="Cuộc trò chuyện nhắn tin" value={numberFmt(row.messagingConversations)} />
            <Field label="ThruPlays" value={numberFmt(row.thruPlays)} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
