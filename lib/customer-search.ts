import { CustomerType } from "@prisma/client";

export type SearchableCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  pec?: string | null;
  taxCode?: string | null;
  vatNumber?: string | null;
  uniqueCode?: string | null;
  type: CustomerType;
};

export function normalizeCustomerSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildCustomerSearchHaystack(customer: SearchableCustomer) {
  return normalizeCustomerSearchValue(
    [
      customer.name,
      customer.phone || "",
      customer.whatsapp || "",
      customer.email || "",
      customer.pec || "",
      customer.taxCode || "",
      customer.vatNumber || "",
      customer.uniqueCode || ""
    ].join(" ")
  );
}

export function getCustomerSearchScore(customer: SearchableCustomer, normalizedQuery: string) {
  const haystack = buildCustomerSearchHaystack(customer);
  const normalizedName = normalizeCustomerSearchValue(customer.name);
  const normalizedPhone = normalizeCustomerSearchValue(customer.phone || "");
  const normalizedWhatsapp = normalizeCustomerSearchValue(customer.whatsapp || "");
  const normalizedEmail = normalizeCustomerSearchValue(customer.email || "");
  const normalizedPec = normalizeCustomerSearchValue(customer.pec || "");
  const normalizedTaxCode = normalizeCustomerSearchValue(customer.taxCode || "");
  const normalizedVatNumber = normalizeCustomerSearchValue(customer.vatNumber || "");
  const normalizedUniqueCode = normalizeCustomerSearchValue(customer.uniqueCode || "");
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!terms.length || !terms.every((term) => haystack.includes(term))) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (normalizedName === normalizedQuery) {
    return 0;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 1;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 2;
  }

  if (normalizedPhone === normalizedQuery || normalizedWhatsapp === normalizedQuery) {
    return 3;
  }

  if (normalizedPhone.includes(normalizedQuery) || normalizedWhatsapp.includes(normalizedQuery)) {
    return 4;
  }

  if (normalizedEmail === normalizedQuery) {
    return 5;
  }

  if (normalizedPec === normalizedQuery) {
    return 5;
  }

  if (normalizedEmail.includes(normalizedQuery)) {
    return 6;
  }

  if (normalizedPec.includes(normalizedQuery)) {
    return 6;
  }

  if (normalizedTaxCode === normalizedQuery || normalizedVatNumber === normalizedQuery || normalizedUniqueCode === normalizedQuery) {
    return 7;
  }

  if (
    normalizedTaxCode.includes(normalizedQuery) ||
    normalizedVatNumber.includes(normalizedQuery) ||
    normalizedUniqueCode.includes(normalizedQuery)
  ) {
    return 8;
  }

  return 9;
}

export function rankCustomers<T extends SearchableCustomer>(customers: T[], query: string) {
  const normalizedQuery = normalizeCustomerSearchValue(query);

  if (!normalizedQuery) {
    return customers;
  }

  return customers
    .map((customer) => ({
      customer,
      score: getCustomerSearchScore(customer, normalizedQuery)
    }))
    .filter((entry) => entry.score !== Number.MAX_SAFE_INTEGER)
    .sort(
      (left, right) =>
        left.score - right.score ||
        left.customer.name.localeCompare(right.customer.name, "it") ||
        (left.customer.phone || "").localeCompare(right.customer.phone || "", "it")
    )
    .map((entry) => entry.customer);
}
