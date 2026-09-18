import { LeadsQueueView } from "@/app/(app)/leads/leads-queue-view";
import { getLeadFormOptions } from "@/app/(app)/leads/get-lead-form-options";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";

export default async function LeadsPage() {
  const [user, options] = await Promise.all([getCurrentUser(), getLeadFormOptions()]);
  await requireFeatureAccess(user, "interactions");

  return <LeadsQueueView options={options} currentUserEmail={user.email} />;
}
