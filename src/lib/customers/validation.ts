import { z } from "zod";

export const assignCustomersSchema = z.object({
  customerKeys: z.array(z.string().min(1)).min(1).max(50),
  targetEmail: z.string().email(),
});

export const transferCustomerSchema = z.object({
  targetEmail: z.string().email(),
});

export const customerProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Vui lòng nhập tên khách hàng."),
  phoneNormalized: z.string().trim().optional().nullable(),
  age: z.number().int().positive().optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  gender: z.string().trim().optional().nullable(),
  parentName: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  level: z.string().trim().optional().nullable(),
  trainingTrack: z.string().trim().optional().nullable(),
  school: z.string().trim().optional().nullable(),
  aspiration: z.string().trim().optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const customerStageSchema = z.object({
  stage: z.string().min(1),
  stageReason: z.string().trim().max(500).optional().nullable(),
  appointmentAt: z.coerce.date().optional().nullable(),
  caseDeadline: z.coerce.date().optional().nullable(),
  needsLeaderSupport: z.boolean().optional(),
});

export const customerCareLogSchema = z.object({
  content: z.string().trim().min(1, "Vui lòng nhập nội dung chăm sóc.").max(2000),
});
