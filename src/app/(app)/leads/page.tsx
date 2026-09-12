import { PageHeader } from "@/components/page-header";
import { LeadPriorityFlow } from "@/app/(app)/leads/lead-priority-flow";
import { LeadsQueueView } from "@/app/(app)/leads/leads-queue-view";
import { getLeadFormOptions } from "@/app/(app)/leads/get-lead-form-options";
import { requireRole } from "@/lib/auth/dal";
import { CAN_REASSIGN, CAN_VIEW_LEAD } from "@/lib/interactions/constants";

export default async function LeadsPage() {
  const [user, options] = await Promise.all([requireRole(...CAN_VIEW_LEAD), getLeadFormOptions()]);
  const canReassign = (CAN_REASSIGN as readonly string[]).includes(user.role);

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Liên hệ"
        action={<LeadPriorityFlow />}
      />
      <LeadsQueueView options={options} currentUserEmail={user.email} currentUserName={user.fullName} canReassign={canReassign} />
    </>
  );
}
