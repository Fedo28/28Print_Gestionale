export type ManualFormDraftSnapshot<FieldName extends string = string> = {
  version: 1;
  savedAt: string;
  fields: Record<FieldName, string>;
};

export const MANUAL_FORM_DRAFT_STORAGE_EVENT = "gestionale:manual-form-draft-changed";

export function buildManualFormDraftStorageKey(scope: string) {
  return `gestionale.form-draft.${scope}`;
}

export function createEmptyManualFormDraftFields<const FieldNames extends readonly string[]>(fieldNames: FieldNames) {
  return Object.fromEntries(fieldNames.map((fieldName) => [fieldName, ""])) as Record<FieldNames[number], string>;
}

export function parseManualFormDraftSnapshot<const FieldNames extends readonly string[]>(
  raw: string | null | undefined,
  fieldNames: FieldNames
) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ManualFormDraftSnapshot<FieldNames[number]>> | null;
    if (!parsed || parsed.version !== 1) {
      return null;
    }

    const baseFields = createEmptyManualFormDraftFields(fieldNames);
    const parsedFields = parsed.fields as Partial<Record<FieldNames[number], string>> | undefined;
    const fields = Object.fromEntries(
      fieldNames.map((fieldName) => {
        const fieldKey = fieldName as FieldNames[number];
        const fieldValue = parsedFields?.[fieldKey];
        return [fieldKey, typeof fieldValue === "string" ? fieldValue : baseFields[fieldKey]];
      })
    ) as Record<FieldNames[number], string>;

    return {
      version: 1 as const,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date(0).toISOString(),
      fields
    };
  } catch {
    return null;
  }
}

export function hasMeaningfulManualFormDraft<FieldName extends string>(snapshot: Pick<ManualFormDraftSnapshot<FieldName>, "fields">) {
  return (Object.values(snapshot.fields) as string[]).some((value) => value.trim().length > 0);
}
