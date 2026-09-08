import { PageHeader } from "@/components/page-header";
import { LeadPriorityFlow } from "@/app/(app)/leads/lead-priority-flow";
import { LeadsQueueView } from "@/app/(app)/leads/leads-queue-view";
import { getLeadFormOptions } from "@/app/(app)/leads/get-lead-form-options";
import { getCurrentUser } from "@/lib/auth/dal";

export default async function LeadsPage() {
  const [user, options] = await Promise.all([getCurrentUser(), getLeadFormOptions()]);

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Liên hệ"
        action={<LeadPriorityFlow />}
      />
      <LeadsQueueView options={options} currentUserEmail={user.email} />
    </>
  );
}
