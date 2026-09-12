import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { CAN_CREATE_OR_EDIT_LEAD, CAN_REASSIGN } from "@/lib/interactions/constants";
import { getStudentProfileDetail } from "@/lib/students/queries";
import { StudentProfileView } from "@/app/(app)/students/[id]/student-profile-view";

export default async function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole(...CAN_CREATE_OR_EDIT_LEAD);
  const { id } = await params;
  const profile = await getStudentProfileDetail(actor, id);

  const canReassign = (CAN_REASSIGN as readonly string[]).includes(actor.role);
  const canEdit = actor.email === profile.assignedToEmail || canReassign;

  return (
    <>
      <PageHeader eyebrow="Vận hành" title={profile.studentName} description={`Tư vấn viên: ${profile.assignedTo.fullName}`} />
      <StudentProfileView
        profile={{
          id: profile.id,
          studentName: profile.studentName,
          age: profile.age,
          dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : null,
          gender: profile.gender,
          parentName: profile.parentName,
          phone: profile.phone,
          address: profile.address,
          level: profile.level,
          trainingTrack: profile.trainingTrack,
          school: profile.school,
          aspiration: profile.aspiration,
          stage: profile.stage,
          stageReason: profile.stageReason,
          caseDeadline: profile.caseDeadline ? profile.caseDeadline.toISOString().slice(0, 10) : null,
          needsLeaderSupport: profile.needsLeaderSupport,
          appointmentAt: profile.appointmentAt ? profile.appointmentAt.toISOString().slice(0, 10) : null,
          note: profile.note,
          channelName: profile.interaction ? `${profile.interaction.fanpageName} · ${profile.interaction.sourceName}` : null,
          conversationLink: profile.interaction?.conversationLink ?? profile.interaction?.rawLink ?? null,
          careLogs: profile.careLogs.map((log) => ({
            id: log.id,
            loggedAt: log.loggedAt.toISOString(),
            loggedByName: log.loggedBy.fullName,
            content: log.content,
            stageAtLogTime: log.stageAtLogTime,
          })),
        }}
        canEdit={canEdit}
        canTransfer={canReassign}
        currentAssignedEmail={profile.assignedToEmail}
      />
    </>
  );
}
