import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { ApiError } from "@/lib/interactions/errors";
import { getInteractionDetail, getFollowupHistory } from "@/lib/interactions/queries";
import { getLeadFormOptions } from "@/app/(app)/leads/get-lead-form-options";
import { FollowupDetailView } from "@/app/(app)/followup-inbox/[id]/followup-detail-view";

export default async function FollowupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentUser();

  let detail;
  try {
    detail = await getInteractionDetail(actor, id);
  } catch (err) {
    if (err instanceof ApiError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const [history, options] = await Promise.all([getFollowupHistory(id), getLeadFormOptions()]);

  return <FollowupDetailView detail={detail} history={history} options={options} />;
}
