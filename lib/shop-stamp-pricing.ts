export type ShopStampModelCode = "C20" | "C30" | "C40" | "C50";

export type ShopStampModelSpec = {
  code: ShopStampModelCode;
  displaySize: string;
  heightMm: number;
  maxLines: number;
  widthMm: number;
};

export type ShopStampFontWeight = "regular" | "bold";

export type ShopStampLineStyle = {
  fontWeight: ShopStampFontWeight;
};

export type ShopStampSelectionInput = {
  fontSizePt?: number | string | null;
  fontWeight?: string | null;
  lineWeights?: string[] | null;
  lines?: string[] | string | null;
  model?: string | null;
  quantity?: number | string | null;
  text?: string | null;
};

export type ShopStampCustomization = {
  fontSizePt: number;
  fontWeight: ShopStampFontWeight;
  lineCount: number;
  lineStyles: ShopStampLineStyle[];
  lines: string[];
  maxLines: number;
  model: ShopStampModelSpec;
  overMaxLines: boolean;
  quantity: number;
  rubberLineTotalCents: number;
  rubberUnitCents: number;
  text: string;
};

export const SHOP_STAMP_RUBBER_LINE_PRICE_CENTS = 200;
export const SHOP_STAMP_DEFAULT_FONT_SIZE_PT = 8;
export const SHOP_STAMP_MIN_FONT_SIZE_PT = 5;
export const SHOP_STAMP_MAX_FONT_SIZE_PT = 12;

export const SHOP_STAMP_MODELS: ShopStampModelSpec[] = [
  {
    code: "C20",
    displaySize: "14x38 mm",
    heightMm: 14,
    maxLines: 2,
    widthMm: 38
  },
  {
    code: "C30",
    displaySize: "18x47 mm",
    heightMm: 18,
    maxLines: 4,
    widthMm: 47
  },
  {
    code: "C40",
    displaySize: "23x59 mm",
    heightMm: 23,
    maxLines: 6,
    widthMm: 59
  },
  {
    code: "C50",
    displaySize: "30x69 mm",
    heightMm: 30,
    maxLines: 8,
    widthMm: 69
  }
];

function parsePositiveInteger(value: unknown, fallback = 1) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(1, Math.round(parsed));
}

function parseFontSize(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || "").replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return SHOP_STAMP_DEFAULT_FONT_SIZE_PT;
  }

  return Math.min(SHOP_STAMP_MAX_FONT_SIZE_PT, Math.max(SHOP_STAMP_MIN_FONT_SIZE_PT, Math.round(parsed * 10) / 10));
}

function normalizeStampFontWeight(value: unknown): ShopStampFontWeight {
  return String(value || "").trim().toLowerCase() === "bold" ? "bold" : "regular";
}

function normalizeStampLineWeights(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => normalizeStampFontWeight(entry));
}

function resolveStampLineWeight(lineWeights: ShopStampFontWeight[], lineIndex: number, fallback: ShopStampFontWeight) {
  return lineWeights[lineIndex] || fallback;
}

function normalizeStampText(value: unknown) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{5,}/g, "\n\n\n\n")
    .trim();
}

export function getShopStampModelSpec(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase();
  return SHOP_STAMP_MODELS.find((model) => model.code === normalized) || SHOP_STAMP_MODELS[0];
}

function estimateStampTextWidthPt(text: string, fontSizePt: number, fontWeight: ShopStampFontWeight) {
  const weightMultiplier = fontWeight === "bold" ? 1.08 : 1;
  return Array.from(text).reduce((total, char) => {
    if (char === " ") {
      return total + fontSizePt * 0.32;
    }
    if ("ilI.,'`|!".includes(char)) {
      return total + fontSizePt * 0.28 * weightMultiplier;
    }
    if ("mwMW@#%&".includes(char)) {
      return total + fontSizePt * 0.74 * weightMultiplier;
    }
    if (/[A-Z0-9]/.test(char)) {
      return total + fontSizePt * 0.58 * weightMultiplier;
    }
    return total + fontSizePt * 0.52 * weightMultiplier;
  }, 0);
}

function wrapLongStampWord(input: {
  availableWidthPt: number;
  fontSizePt: number;
  fontWeight: ShopStampFontWeight;
  word: string;
}) {
  const chunks: string[] = [];
  let current = "";

  Array.from(input.word).forEach((char) => {
    const candidate = `${current}${char}`;
    if (current && estimateStampTextWidthPt(candidate, input.fontSizePt, input.fontWeight) > input.availableWidthPt) {
      chunks.push(current);
      current = char;
      return;
    }

    current = candidate;
  });

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export function wrapShopStampText(input: {
  fontSizePt: number;
  fontWeight: ShopStampFontWeight;
  lineWeights?: ShopStampFontWeight[];
  model: ShopStampModelSpec;
  text: string;
}) {
  const availableWidthPt = Math.max(8, (input.model.widthMm * 72) / 25.4 - 8);
  const paragraphs = normalizeStampText(input.text).split("\n");
  const lines: string[] = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      if (lines.length) {
        lines.push("");
      }
      return;
    }

    let currentLine = "";
    words.forEach((word) => {
      const activeFontWeight = resolveStampLineWeight(input.lineWeights || [], lines.length, input.fontWeight);
      const wordChunks =
        estimateStampTextWidthPt(word, input.fontSizePt, activeFontWeight) > availableWidthPt
          ? wrapLongStampWord({
              availableWidthPt,
              fontSizePt: input.fontSizePt,
              fontWeight: activeFontWeight,
              word
            })
          : [word];

      wordChunks.forEach((chunk) => {
        const candidate = currentLine ? `${currentLine} ${chunk}` : chunk;
        const lineFontWeight = resolveStampLineWeight(input.lineWeights || [], lines.length, input.fontWeight);
        if (currentLine && estimateStampTextWidthPt(candidate, input.fontSizePt, lineFontWeight) > availableWidthPt) {
          lines.push(currentLine);
          currentLine = chunk;
          return;
        }

        currentLine = candidate;
      });
    });

    if (currentLine) {
      lines.push(currentLine);
    }
  });

  return lines.filter((line, index, list) => line || index < list.length - 1);
}

export function normalizeShopStampSelection(value: unknown): ShopStampSelectionInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawLineStyles = Array.isArray(record.lineStyles)
    ? record.lineStyles
        .map((entry) => (entry && typeof entry === "object" ? (entry as Record<string, unknown>).fontWeight : null))
        .filter((entry): entry is string => typeof entry === "string")
    : null;
  return {
    fontSizePt: record.fontSizePt as ShopStampSelectionInput["fontSizePt"],
    fontWeight: typeof record.fontWeight === "string" ? record.fontWeight : null,
    lineWeights: Array.isArray(record.lineWeights)
      ? record.lineWeights.map((entry) => String(entry || "regular"))
      : rawLineStyles,
    lines: Array.isArray(record.lines) || typeof record.lines === "string" ? (record.lines as string[] | string) : null,
    model: typeof record.model === "string" ? record.model : null,
    quantity: record.quantity as ShopStampSelectionInput["quantity"],
    text: typeof record.text === "string" ? record.text : null
  };
}

export function computeShopStampCustomization(input: ShopStampSelectionInput): ShopStampCustomization {
  const model = getShopStampModelSpec(input.model);
  const fontSizePt = parseFontSize(input.fontSizePt);
  const fontWeight = normalizeStampFontWeight(input.fontWeight);
  const lineWeights = normalizeStampLineWeights(input.lineWeights);
  const text = normalizeStampText(input.text || (Array.isArray(input.lines) ? input.lines.join("\n") : input.lines));
  const lines = wrapShopStampText({
    fontSizePt,
    fontWeight,
    lineWeights,
    model,
    text
  });
  const quantity = parsePositiveInteger(input.quantity, 1);
  const lineCount = lines.length;
  const lineStyles = lines.map((_, index) => ({
    fontWeight: resolveStampLineWeight(lineWeights, index, fontWeight)
  }));
  const rubberUnitCents = lineCount * SHOP_STAMP_RUBBER_LINE_PRICE_CENTS;

  return {
    fontSizePt,
    fontWeight,
    lineCount,
    lineStyles,
    lines,
    maxLines: model.maxLines,
    model,
    overMaxLines: lineCount > model.maxLines,
    quantity,
    rubberLineTotalCents: rubberUnitCents * quantity,
    rubberUnitCents,
    text
  };
}

export function buildShopStampSummaryLines(stamp: ShopStampCustomization) {
  const sharedLineWeight = stamp.lineStyles.every((style) => style.fontWeight === stamp.fontWeight)
    ? stamp.fontWeight
    : null;

  return [
    `Modello: Timbro ${stamp.model.code}`,
    `Misura: ${stamp.model.displaySize}`,
    `Stile: Arial ${sharedLineWeight ? `${sharedLineWeight} ` : ""}${stamp.fontSizePt} pt`,
    `Testo timbro: ${stamp.lineCount} righe`,
    `Gommina: ${stamp.lineCount} x 2,00 EUR`
  ];
}
