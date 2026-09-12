"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/dal";
import { createStudentAssignments } from "@/lib/students/mutations";

export async function assignStudentsBulk(input: { interactionIds: string[]; assignedToEmail: string }) {
  const actor = await getCurrentUser();
  const result = await createStudentAssignments(actor, input);
  revalidatePath("/student-assignment");
  revalidatePath("/students");
  return result;
}
