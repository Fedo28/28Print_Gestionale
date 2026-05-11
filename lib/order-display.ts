export function stripOrderCodeDatePrefix(orderCode: string) {
  return orderCode.replace(/^\d{4}-\d{2}-\d{2}_/, "");
}

export function getDisplayOrderLabel(orderCode: string, fallbackTitle?: string | null) {
  const stripped = stripOrderCodeDatePrefix(orderCode)
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped) {
    return stripped;
  }

  return (fallbackTitle || "").trim() || orderCode;
}
