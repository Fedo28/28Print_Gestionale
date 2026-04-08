import { CustomerType } from "@prisma/client";

export type CustomerTypeFilter = CustomerType | "ALL";

const customerTypes: CustomerType[] = ["PUBBLICO", "AZIENDA"];

export function parseCustomerTypeFilter(raw: string | null): CustomerTypeFilter {
  return raw && customerTypes.includes(raw as CustomerType) ? (raw as CustomerType) : "ALL";
}

export function buildCustomersFilterHref(filters: { type?: CustomerTypeFilter }) {
  const params = new URLSearchParams();

  if (filters.type && filters.type !== "ALL") {
    params.set("type", filters.type);
  }

  const query = params.toString();
  return query ? `/customers?${query}` : "/customers";
}
