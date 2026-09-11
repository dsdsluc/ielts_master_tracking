import Link from "next/link";
import { ArrowLeft, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth/dal";
import { CAN_CREATE_OR_EDIT_LEAD } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { customerScopeWhere } from "@/app/(app)/customers/customer-scope";
import { DuplicateMergeView, type DuplicateCandidate } from "@/app/(app)/customers/duplicates/[phone]/duplicate-merge-view";

export default async function DuplicateCustomerDetailPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const user = await requireRole(...CAN_CREATE_OR_EDIT_LEAD);
  const { phone: rawPhone } = await params;
  const phone = decodeURIComponent(rawPhone);

  const [customers, branches] = await Promise.all([
    prisma.customer.findMany({
      where: { ...customerScopeWhere(user), phoneNormalized: phone },
      select: {
        customerKey: true,
        displayName: true,
        canonicalLink: true,
        phoneNormalized: true,
        currentStatusName: true,
        firstTouchAt: true,
        lastTouchAt: true,
        interactions: {
          select: {
            interactionId: true,
            rawLink: true,
            sourceName: true,
            fanpageName: true,
            adId: true,
            statusName: true,
            assignedBranchCode: true,
            createdLeadAt: true,
            createdBy: { select: { fullName: true } },
          },
          orderBy: { createdLeadAt: "desc" },
        },
      },
      orderBy: { lastTouchAt: "desc" },
    }),
    prisma.branch.findMany({ select: { code: true, name: true } }),
  ]);
  const branchNames = Object.fromEntries(branches.map((b) => [b.code, b.name]));

  const backLink = (
    <Button variant="outline" size="icon-sm" className="rounded-full" nativeButton={false} render={<Link href="/customers/duplicates" />} aria-label="Quay lại danh sách trùng">
      <ArrowLeft className="size-4" />
    </Button>
  );

  if (customers.length < 2) {
    return (
      <>
        <div className="mb-6 flex items-center gap-3">
          {backLink}
          <span className="font-heading text-xl font-semibold text-foreground">SĐT {phone}</span>
        </div>
        <EmptyState
          icon={GitMerge}
          title="Không còn trùng lặp"
          description="Chỉ còn 1 (hoặc 0) bản ghi khách hàng với số điện thoại này — có thể đã được gộp trước đó."
        />
      </>
    );
  }

  const candidates: DuplicateCandidate[] = customers.map((c) => ({
    customerKey: c.customerKey,
    displayName: c.displayName,
    canonicalLink: c.canonicalLink,
    phoneNormalized: c.phoneNormalized,
    currentStatusName: c.currentStatusName,
    firstTouchAt: c.firstTouchAt.toISOString(),
    lastTouchAt: c.lastTouchAt.toISOString(),
    interactions: c.interactions.map((i) => ({
      interactionId: i.interactionId,
      rawLink: i.rawLink,
      sourceName: i.sourceName,
      fanpageName: i.fanpageName,
      adId: i.adId,
      statusName: i.statusName,
      branchName: branchNames[i.assignedBranchCode] ?? i.assignedBranchCode,
      createdByName: i.createdBy?.fullName ?? null,
      createdLeadAt: i.createdLeadAt.toISOString(),
    })),
  }));

  return <DuplicateMergeView phone={phone} candidates={candidates} backLink={backLink} />;
}
