"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { addCareLog, transferStudentProfile, updateStudentProfile, type UpdateStudentProfileInput } from "@/lib/students/mutations";
import { getAssignableSales } from "@/lib/students/queries";

export async function saveStudentProfile(id: string, input: UpdateStudentProfileInput) {
  const actor = await getCurrentUser();
  await updateStudentProfile(actor, id, input);
  revalidatePath(`/students/${id}`);
  revalidatePath("/students");
}

export async function addStudentCareLog(id: string, content: string) {
  const actor = await getCurrentUser();
  await addCareLog(actor, id, content);
  revalidatePath(`/students/${id}`);
}

export async function fetchTransferTargets() {
  const actor = await getCurrentUser();
  const sales = await getAssignableSales(actor);
  return sales.map((s) => ({ email: s.email, fullName: s.fullName }));
}

export async function transferStudent(id: string, targetEmail: string, reason: string) {
  const actor = await getCurrentUser();
  await transferStudentProfile(actor, id, targetEmail, reason);
  revalidatePath(`/students/${id}`);
  revalidatePath("/students");
  revalidatePath("/student-assignment/stats");
}
