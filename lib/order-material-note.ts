import { orderMaterialCategoryOptions } from "@/lib/constants";

export type OrderMaterialCategoryKey = (typeof orderMaterialCategoryOptions)[number]["key"];

export type OrderMaterialCategoryCounts = Record<OrderMaterialCategoryKey, string>;

export type OrderMaterialCategoryEntry = {
  key: OrderMaterialCategoryKey;
  label: string;
  quantity: number;
};

const categoryLabelToKey = new Map<string, OrderMaterialCategoryKey>(
  orderMaterialCategoryOptions.map(({ key, label }) => [label, key])
);

function normalizeInteger(value: string | number | null | undefined) {
  const raw = typeof value === "number" ? value : Number(String(value || "").trim());
  if (!Number.isFinite(raw)) {
    return 0;
  }

  return Math.max(0, Math.floor(raw));
}

export function createEmptyOrderMaterialCategoryCounts(): OrderMaterialCategoryCounts {
  return Object.fromEntries(orderMaterialCategoryOptions.map(({ key }) => [key, ""])) as OrderMaterialCategoryCounts;
}

export function getOrderMaterialCategoryEntries(
  counts: Partial<Record<OrderMaterialCategoryKey, string | number | null | undefined>>
): OrderMaterialCategoryEntry[] {
  return orderMaterialCategoryOptions.flatMap(({ key, label }) => {
    const quantity = normalizeInteger(counts[key]);
    if (quantity <= 0) {
      return [];
    }

    return [{ key, label, quantity }];
  });
}

export function getOrderMaterialCategoryEntriesFromFormData(formData: FormData) {
  return getOrderMaterialCategoryEntries(
    Object.fromEntries(orderMaterialCategoryOptions.map(({ key }) => [key, formData.get(`materialCategoryCount-${key}`)?.toString() || ""]))
  );
}

export function buildOrderMaterialNoteContent(options: {
  content: string;
  categoryEntries: OrderMaterialCategoryEntry[];
}) {
  const normalizedContent = options.content.replace(/\r\n/g, "\n").trim();
  const sections: string[] = [];

  if (options.categoryEntries.length > 0) {
    sections.push(["Categorie:", ...options.categoryEntries.map((entry) => `- ${entry.label}: ${entry.quantity}`)].join("\n"));
  }

  if (normalizedContent) {
    sections.push(normalizedContent);
  }

  return sections.join("\n\n");
}

export function parseOrderMaterialNoteContent(value: string) {
  const normalizedValue = value.replace(/\r\n/g, "\n").trim();
  const categoryCounts = createEmptyOrderMaterialCategoryCounts();

  if (!normalizedValue.startsWith("Categorie:")) {
    return {
      content: normalizedValue,
      categoryCounts
    };
  }

  const lines = normalizedValue.split("\n");
  if (lines[0]?.trim() !== "Categorie:") {
    return {
      content: normalizedValue,
      categoryCounts
    };
  }

  let lineIndex = 1;
  let matchedCategories = 0;

  while (lineIndex < lines.length) {
    const currentLine = lines[lineIndex]?.trim() || "";
    if (!currentLine) {
      break;
    }

    const match = /^- (.+?): (\d+)$/.exec(currentLine);
    if (!match) {
      break;
    }

    const [, label, quantity] = match;
    const key = categoryLabelToKey.get(label.trim());
    if (!key) {
      break;
    }

    categoryCounts[key] = String(normalizeInteger(quantity));
    matchedCategories += 1;
    lineIndex += 1;
  }

  if (matchedCategories === 0) {
    return {
      content: normalizedValue,
      categoryCounts: createEmptyOrderMaterialCategoryCounts()
    };
  }

  while (lineIndex < lines.length && !lines[lineIndex]?.trim()) {
    lineIndex += 1;
  }

  return {
    content: lines.slice(lineIndex).join("\n").trim(),
    categoryCounts
  };
}
