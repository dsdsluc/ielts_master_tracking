import type { Prisma } from "@/generated/prisma/client";

export const customerDetailInclude = {
  assignedTo: { select: { fullName: true, email: true } },
  assignedBy: { select: { fullName: true } },
  careLogs: { orderBy: { loggedAt: "desc" }, include: { loggedBy: { select: { fullName: true } } } },
} satisfies Prisma.CustomerInclude;

type CustomerRow = Prisma.CustomerGetPayload<{ include: typeof customerDetailInclude }>;

export type CustomerCareLogEntry = {
  id: string;
  loggedAt: string;
  loggedByName: string;
  content: string;
  stageAtLogTime: string | null;
};

export type CustomerDetail = {
  customerKey: string;
  displayName: string;
  canonicalLink: string;
  phoneNormalized: string | null;
  currentStatusName: string;
  age: number | null;
  dateOfBirth: string | null;
  gender: string | null;
  parentName: string | null;
  address: string | null;
  level: string | null;
  trainingTrack: string | null;
  school: string | null;
  aspiration: string | null;
  stage: string | null;
  stageReason: string | null;
  enrolledAt: string | null;
  caseDeadline: string | null;
  needsLeaderSupport: boolean;
  appointmentAt: string | null;
  assignedToEmail: string | null;
  assignedToName: string | null;
  assignedByName: string | null;
  assignedAt: string | null;
  note: string | null;
  firstTouchAt: string;
  lastTouchAt: string;
  careLogs: CustomerCareLogEntry[];
};

export function toCustomerDetail(row: CustomerRow): CustomerDetail {
  return {
    customerKey: row.customerKey,
    displayName: row.displayName,
    canonicalLink: row.canonicalLink,
    phoneNormalized: row.phoneNormalized,
    currentStatusName: row.currentStatusName,
    age: row.age,
    dateOfBirth: row.dateOfBirth?.toISOString() ?? null,
    gender: row.gender,
    parentName: row.parentName,
    address: row.address,
    level: row.level,
    trainingTrack: row.trainingTrack,
    school: row.school,
    aspiration: row.aspiration,
    stage: row.stage,
    stageReason: row.stageReason,
    enrolledAt: row.enrolledAt?.toISOString() ?? null,
    caseDeadline: row.caseDeadline?.toISOString() ?? null,
    needsLeaderSupport: row.needsLeaderSupport,
    appointmentAt: row.appointmentAt?.toISOString() ?? null,
    assignedToEmail: row.assignedToEmail,
    assignedToName: row.assignedTo?.fullName ?? null,
    assignedByName: row.assignedBy?.fullName ?? null,
    assignedAt: row.assignedAt?.toISOString() ?? null,
    note: row.note,
    firstTouchAt: row.firstTouchAt.toISOString(),
    lastTouchAt: row.lastTouchAt.toISOString(),
    careLogs: row.careLogs.map((l) => ({
      id: l.id,
      loggedAt: l.loggedAt.toISOString(),
      loggedByName: l.loggedBy.fullName,
      content: l.content,
      stageAtLogTime: l.stageAtLogTime,
    })),
  };
}
