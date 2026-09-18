"use client";

import { apiFetch } from "@/lib/api-client";
import type { CustomerDetail } from "@/lib/customers/serialize";
import type { CustomerProfileInput, CustomerStageInput } from "@/lib/customers/mutations";

export type { CustomerDetail };

export async function fetchCustomerDetail(key: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/api/customers/${key}`, { cache: "no-store" });
}

export async function assignCustomers(customerKeys: string[], targetEmail: string): Promise<{ assigned: number; skipped: number }> {
  return apiFetch("/api/customers/assign", { method: "POST", body: JSON.stringify({ customerKeys, targetEmail }) });
}

export async function transferCustomer(key: string, targetEmail: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/api/customers/${key}/transfer`, { method: "POST", body: JSON.stringify({ targetEmail }) });
}

export async function reclaimCustomers(customerKeys: string[]): Promise<{ reclaimed: number; skipped: number }> {
  return apiFetch("/api/customers/reclaim", { method: "POST", body: JSON.stringify({ customerKeys }) });
}

export async function transferCustomersBulk(customerKeys: string[], targetEmail: string): Promise<{ moved: number; skipped: number }> {
  return apiFetch("/api/customers/transfer-bulk", { method: "POST", body: JSON.stringify({ customerKeys, targetEmail }) });
}

export async function updateCustomerProfile(key: string, input: CustomerProfileInput): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/api/customers/${key}`, { method: "PATCH", body: JSON.stringify(input) });
}

export async function updateCustomerStage(key: string, input: CustomerStageInput): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/api/customers/${key}/stage`, { method: "POST", body: JSON.stringify(input) });
}

export async function logCustomerCare(key: string, content: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/api/customers/${key}/care-logs`, { method: "POST", body: JSON.stringify({ content }) });
}
