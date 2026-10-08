"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatAttachmentMaxSize, formatAttachmentSize } from "@/lib/attachment-utils";
import {
  SHOP_FILE_ALLOWED_EXTENSIONS,
  SHOP_FILE_MAX_SIZE_BYTES,
  validateShopFileCandidate
} from "@/lib/domain/files/shop-file-assets";
import {
  buildShopBannerSummaryLines,
  computeShopBannerQuote,
  formatShopBannerMetric,
  getShopBannerMaterialLabel,
  SHOP_BANNER_MAX_HEIGHT_M,
  type ShopBannerSelectionInput
} from "@/lib/shop-banner-pricing";
import {
  buildShopLabelSummaryLines,
  computeShopLabelQuote,
  formatShopLabelMetric,
  getShopLabelMaterialLabel,
  type ShopLabelSelectionInput
} from "@/lib/label-calculator";
import { applyShopCatalogPriceMultiplier } from "@/lib/shop-catalog-customizations";
import type { ShopCatalogProductPage } from "@/lib/shop-product-pages";
import {
  buildShopStampSummaryLines,
  computeShopStampCustomization,
  SHOP_STAMP_DEFAULT_FONT_SIZE_PT,
  type ShopStampCustomization,
  type ShopStampFontWeight,
  type ShopStampSelectionInput
} from "@/lib/shop-stamp-pricing";
import {
  buildShopStickerSummaryLines,
  computeShopStickerQuote,
  formatShopStickerMetric,
  getShopStickerMaterialLabel,
  type ShopStickerSelectionInput
} from "@/lib/shop-sticker-pricing";

type ShopCatalogProductConfiguratorProps = {
  page: ShopCatalogProductPage;
};

type CreateCatalogOrderResponse = {
  orderId: string;
  redirectPath: string;
  salesOrderItemId: string | null;
  success: true;
};

type QueuedCatalogFile = {
  error: string | null;
  file: File;
  id: string;
  quantity: number;
  status: "ready" | "uploading" | "error";
};

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  currency: "EUR",
  style: "currency"
});

function formatPrice(cents: number) {
  return currencyFormatter.format(cents / 100);
}

function buildQueuedCatalogFileId(file: File, index: number) {
  return `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${index}`;
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function parseBannerMetricDraft(value: string, fallback: number) {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed * 100) / 100;
}

function formatBannerDraft(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

function sanitizePdfText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdfDocument(objects: string[]) {
  let body = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;

  return body;
}

function buildStampPdfFile(stamp: ShopStampCustomization) {
  const pageWidth = Math.max(1, (stamp.model.widthMm * 72) / 25.4);
  const pageHeight = Math.max(1, (stamp.model.heightMm * 72) / 25.4);
  const lineHeight = stamp.fontSizePt * 1.2;
  const fontSize = stamp.fontSizePt;
  const startY = (pageHeight + lineHeight * (stamp.lineCount - 1)) / 2 - fontSize * 0.35;
  const textCommands = stamp.lines
    .map((line, index) => {
      const safeLine = sanitizePdfText(line);
      const lineFontWeight = stamp.lineStyles[index]?.fontWeight || stamp.fontWeight;
      const estimatedWidth = safeLine.length * fontSize * (lineFontWeight === "bold" ? 0.58 : 0.54);
      const x = Math.max(1.5, (pageWidth - estimatedWidth) / 2);
      const y = Math.max(1.5, startY - index * lineHeight);
      return `BT /${lineFontWeight === "bold" ? "F2" : "F1"} ${fontSize.toFixed(2)} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${safeLine}) Tj ET`;
    })
    .join("\n");
  const content = `0 0 0 rg\n${textCommands}`;
  const pdf = buildPdfDocument([
    "<</Type /Catalog /Pages 2 0 R>>",
    "<</Type /Pages /Kids [3 0 R] /Count 1>>",
    `<</Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources <</Font <</F1 4 0 R /F2 5 0 R>>>> /Contents 6 0 R>>`,
    "<</Type /Font /Subtype /Type1 /BaseFont /Arial>>",
    "<</Type /Font /Subtype /Type1 /BaseFont /Arial-BoldMT>>",
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`
  ]);
  const blob = new Blob([pdf], { type: "application/pdf" });
  return new File([blob], `timbro-${stamp.model.code.toLowerCase()}.pdf`, {
    type: "application/pdf"
  });
}

async function createCatalogOrder(payload: {
  catalogSelection?: {
    banner?: ShopBannerSelectionInput | null;
    copiesPerSubject?: number | null;
    label?: ShopLabelSelectionInput | null;
    paperId?: string | null;
    paperVariantId?: string | null;
    stamp?: ShopStampSelectionInput | null;
    sticker?: ShopStickerSelectionInput | null;
    subjectCount?: number | null;
    subjectPricingMode?: "per-subject" | "total-quantity" | null;
    subjectQuantities?: number[] | null;
  };
  configurationSummary: string;
  customerNote: string;
  invoiceRequested: boolean;
  orderKind: "catalog";
  quantity: number;
  serviceId: string;
  serviceLabel: string;
  sourcePath: string;
}) {
  const response = await fetch("/api/shop/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Ordine shop non creato.");
  }

  return (await response.json()) as CreateCatalogOrderResponse;
}

async function uploadCatalogOrderFile(orderId: string, salesOrderItemId: string | null, file: File) {
  const formData = new FormData();
  if (salesOrderItemId) {
    formData.set("salesOrderItemId", salesOrderItemId);
  }
  formData.set("file", file);

  const response = await fetch(`/api/shop/orders/${orderId}/files`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Upload file shop non riuscito.");
  }
}

export function ShopCatalogProductConfigurator({ page }: ShopCatalogProductConfiguratorProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quantityMode = page.quantityMode || "tiers";
  const supportsSubjects = page.subjectMode === "multi";
  const subjectPricingMode = page.subjectPricingMode || "total-quantity";
  const isBannerCalculator = page.customCalculator === "banner-size";
  const isLabelCalculator = page.customCalculator === "label-size";
  const isStampConfigurator = page.customCalculator === "stamp-text";
  const isStickerCalculator = page.customCalculator === "sticker-size";
  const usesGeneratedFile = page.fileMode === "generated";
  const usesFileCountQuantity = page.fileQuantityMode === "file-count";
  const firstOption = page.options[0] || null;
  const [selectedId, setSelectedId] = useState(firstOption?.id || "");
  const selectedOption = page.options.find((option) => option.id === selectedId) || firstOption;
  const defaultUnitQuantity = isLabelCalculator ? 100 : 1;
  const firstQuantity = quantityMode === "unit-input" ? defaultUnitQuantity : selectedOption?.quantities[0]?.quantity || 0;
  const [selectedQuantity, setSelectedQuantity] = useState(firstQuantity);
  const [bannerWidthDraft, setBannerWidthDraft] = useState(
    firstOption?.bannerPreset ? formatBannerDraft(firstOption.bannerPreset.widthM) : "1"
  );
  const [bannerHeightDraft, setBannerHeightDraft] = useState(
    firstOption?.bannerPreset ? formatBannerDraft(firstOption.bannerPreset.heightM) : "1"
  );
  const [bannerReinforced, setBannerReinforced] = useState(firstOption?.bannerPreset?.reinforced ?? true);
  const [stickerWidthDraft, setStickerWidthDraft] = useState("100");
  const [stickerHeightDraft, setStickerHeightDraft] = useState("50");
  const [labelWidthDraft, setLabelWidthDraft] = useState("5");
  const [labelHeightDraft, setLabelHeightDraft] = useState("5");
  const [stampTextDraft, setStampTextDraft] = useState("");
  const [stampFontSizePt, setStampFontSizePt] = useState(SHOP_STAMP_DEFAULT_FONT_SIZE_PT);
  const [stampLineWeights, setStampLineWeights] = useState<ShopStampFontWeight[]>([]);
  const firstPaperChoice = page.paperChoices?.[0] || null;
  const [selectedPaperId, setSelectedPaperId] = useState(firstPaperChoice?.id || "");
  const selectedPaperChoice = page.paperChoices?.find((choice) => choice.id === selectedPaperId) || firstPaperChoice;
  const firstPaperVariant = selectedPaperChoice?.variants?.[0] || null;
  const [selectedPaperVariantId, setSelectedPaperVariantId] = useState(firstPaperVariant?.id || "");
  const selectedPaperVariant =
    selectedPaperChoice?.variants?.find((variant) => variant.id === selectedPaperVariantId) ||
    selectedPaperChoice?.variants?.[0] ||
    null;
  const [queuedFiles, setQueuedFiles] = useState<QueuedCatalogFile[]>([]);
  const [customerNote, setCustomerNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsFileChoice, setNeedsFileChoice] = useState(false);
  const [createdOrderPath, setCreatedOrderPath] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRouting, startRouting] = useTransition();

  const bannerQuote = useMemo(() => {
    if (!isBannerCalculator || !selectedOption?.bannerMaterial) {
      return null;
    }

    const preset = selectedOption.bannerPreset;
    return computeShopBannerQuote({
      heightM: preset?.heightM ?? parseBannerMetricDraft(bannerHeightDraft, 1),
      material: selectedOption.bannerMaterial,
      priceProfile: selectedOption.bannerKind === "standard" ? "standard-3x1" : "custom",
      quantity: selectedQuantity || 1,
      reinforced: preset?.reinforced ?? bannerReinforced,
      widthM: preset?.widthM ?? parseBannerMetricDraft(bannerWidthDraft, 1)
    });
  }, [
    bannerHeightDraft,
    bannerReinforced,
    bannerWidthDraft,
    isBannerCalculator,
    selectedOption,
    selectedQuantity
  ]);

  const stampCustomization = useMemo(() => {
    if (!isStampConfigurator || !selectedOption?.stampSpec || !selectedOption.stampModel) {
      return null;
    }

    return computeShopStampCustomization({
      fontSizePt: stampFontSizePt,
      fontWeight: "regular",
      lineWeights: stampLineWeights,
      model: selectedOption.stampModel,
      quantity: selectedQuantity || 1,
      text: stampTextDraft
    });
  }, [isStampConfigurator, selectedOption, selectedQuantity, stampFontSizePt, stampLineWeights, stampTextDraft]);

  const stickerQuote = useMemo(() => {
    if (!isStickerCalculator || !selectedOption?.stickerMaterial) {
      return null;
    }

    return computeShopStickerQuote({
      heightCm: stickerHeightDraft,
      material: selectedOption.stickerMaterial,
      pricePerSqmCents: selectedOption.quantities[0]?.priceCents || 0,
      widthCm: stickerWidthDraft
    });
  }, [isStickerCalculator, selectedOption, stickerHeightDraft, stickerWidthDraft]);

  const labelQuote = useMemo(() => {
    if (!isLabelCalculator || !selectedOption?.labelMaterial) {
      return null;
    }

    return computeShopLabelQuote({
      heightCm: labelHeightDraft,
      material: selectedOption.labelMaterial,
      pricePerSqmCents: selectedOption.quantities[0]?.priceCents || 0,
      quantity: selectedQuantity || defaultUnitQuantity,
      widthCm: labelWidthDraft
    });
  }, [
    defaultUnitQuantity,
    isLabelCalculator,
    labelHeightDraft,
    labelWidthDraft,
    selectedOption,
    selectedQuantity
  ]);

  useEffect(() => {
    if (!labelQuote || selectedQuantity >= labelQuote.minimumQuantity) {
      return;
    }

    setSelectedQuantity(labelQuote.minimumQuantity);
  }, [labelQuote, selectedQuantity]);

  const selectedBaseQuantityOption = useMemo(() => {
    if (!selectedOption) {
      return null;
    }

    if (bannerQuote) {
      return {
        priceCents: bannerQuote.totalCents,
        quantity: bannerQuote.quantity
      };
    }

    if (stickerQuote) {
      return {
        priceCents: stickerQuote.totalCents,
        quantity: stickerQuote.billableSqm
      };
    }

    if (labelQuote) {
      return {
        priceCents: labelQuote.totalCents,
        quantity: labelQuote.quantity
      };
    }

    if (quantityMode === "unit-input") {
      const baseQuantity = selectedOption.quantities[0] || null;
      if (!baseQuantity) {
        return null;
      }

      const quantity = Math.max(1, Math.round(Number(selectedQuantity) || 1));
      const unitQuantity = Math.max(1, baseQuantity.quantity || 1);
      const unitPriceCents = Math.round(baseQuantity.priceCents / unitQuantity);
      const stampExtraCents = stampCustomization ? stampCustomization.rubberLineTotalCents : 0;

      return {
        quantity,
        priceCents: unitPriceCents * quantity + stampExtraCents
      };
    }

    return (
      selectedOption.quantities.find((quantity) => quantity.quantity === selectedQuantity) ||
      selectedOption.quantities[0] ||
      null
    );
  }, [bannerQuote, labelQuote, quantityMode, selectedOption, selectedQuantity, stampCustomization, stickerQuote]);

  const fileSubjectQuantities = useMemo(
    () => queuedFiles.map((entry) => Math.max(1, Math.round(Number(entry.quantity) || 1))),
    [queuedFiles]
  );
  const uploadedFileCountQuantity = usesFileCountQuantity ? queuedFiles.length : 0;
  const subjectCount = supportsSubjects && fileSubjectQuantities.length ? fileSubjectQuantities.length : 1;
  const hasFileSubjects = supportsSubjects && fileSubjectQuantities.length > 0;

  function resolveQuantityPrice(quantity: number) {
    if (!selectedOption || !selectedBaseQuantityOption) {
      return null;
    }

    const normalizedQuantity = Math.max(1, Math.round(Number(quantity) || 1));
    if (quantityMode === "unit-input") {
      const unitPriceCents = Math.round(selectedBaseQuantityOption.priceCents / Math.max(1, selectedBaseQuantityOption.quantity));
      return {
        quantity: normalizedQuantity,
        priceCents: unitPriceCents * normalizedQuantity
      };
    }

    const matchedQuantity =
      selectedOption.quantities.find((quantityOption) => quantityOption.quantity === normalizedQuantity) ||
      [...selectedOption.quantities]
        .sort((first, second) => second.quantity - first.quantity)
        .find((quantityOption) => quantityOption.quantity <= normalizedQuantity) ||
      selectedBaseQuantityOption;
    const unitPriceCents = Math.round(matchedQuantity.priceCents / Math.max(1, matchedQuantity.quantity));

    return {
      quantity: normalizedQuantity,
      priceCents: unitPriceCents * normalizedQuantity
    };
  }

  const selectedQuantityOption = useMemo(() => {
    if (!selectedBaseQuantityOption) {
      return null;
    }

    if (usesFileCountQuantity) {
      return uploadedFileCountQuantity > 0 ? resolveQuantityPrice(uploadedFileCountQuantity) : null;
    }

    if (!hasFileSubjects) {
      return selectedBaseQuantityOption;
    }

    const subjectQuotes = fileSubjectQuantities
      .map((quantity) => resolveQuantityPrice(quantity))
      .filter((quantityOption): quantityOption is { priceCents: number; quantity: number } => Boolean(quantityOption));

    return {
      quantity: subjectQuotes.reduce((total, quantityOption) => total + quantityOption.quantity, 0),
      priceCents: subjectQuotes.reduce((total, quantityOption) => total + quantityOption.priceCents, 0)
    };
  }, [
    fileSubjectQuantities,
    hasFileSubjects,
    quantityMode,
    selectedBaseQuantityOption,
    selectedOption,
    uploadedFileCountQuantity,
    usesFileCountQuantity
  ]);

  const selectedProductImage = useMemo(() => {
    const fallbackImage = page.imageSrc
      ? {
          alt: page.imageAlt || page.title,
          src: page.imageSrc
        }
      : null;

    if (!selectedOption) {
      return fallbackImage;
    }

    const normalizedCode = String(selectedOption.code || "").toLowerCase();
    const normalizedLabel = selectedOption.label.toLowerCase();
    const matchedRule = page.optionImageRules?.find((rule) => {
      const matchesCode = rule.codeIncludes?.some((term) => normalizedCode.includes(term.toLowerCase()));
      const matchesLabel = rule.labelIncludes?.some((term) => normalizedLabel.includes(term.toLowerCase()));
      return Boolean(matchesCode || matchesLabel);
    });

    return matchedRule
      ? {
          alt: matchedRule.imageAlt,
          src: matchedRule.imageSrc
        }
      : fallbackImage;
  }, [
    page.imageAlt,
    page.imageSrc,
    page.optionImageRules,
    page.title,
    selectedOption
  ]);

  const priceMultiplier = selectedPaperChoice?.priceMultiplier || 1;
  const selectedTotalPriceCents = selectedQuantityOption
    ? applyShopCatalogPriceMultiplier(selectedQuantityOption.priceCents, priceMultiplier)
    : null;
  const selectedPaperSummary = selectedPaperChoice
    ? [
        selectedPaperChoice.label,
        selectedPaperChoice.note,
        selectedPaperVariant ? selectedPaperVariant.label.toLowerCase() : null
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const selectedPaperSurchargePercent = Math.max(0, Math.round((priceMultiplier - 1) * 100));
  const optionSectionLabel = page.optionSectionLabel || "Lavorazione";
  const quantityUnitLabel = stickerQuote ? "mq" : "pz";
  const quantityInputLabel = labelQuote ? "Etichette" : "Copie";
  const fileUploadHint = usesFileCountQuantity
    ? `${page.fileUploadHint || "Carica JPG o PNG: ogni immagine vale 1 foto"}, max ${formatAttachmentMaxSize(SHOP_FILE_MAX_SIZE_BYTES)}`
    : page.fileUploadHint
      ? `${page.fileUploadHint}, max ${formatAttachmentMaxSize(SHOP_FILE_MAX_SIZE_BYTES)}`
      : supportsSubjects
        ? `Ogni file e un soggetto, max ${formatAttachmentMaxSize(SHOP_FILE_MAX_SIZE_BYTES)}`
        : `PDF, JPG o PNG, max ${formatAttachmentMaxSize(SHOP_FILE_MAX_SIZE_BYTES)}`;
  const fileInputAccept = usesFileCountQuantity
    ? ".jpg,.jpeg,.png,image/jpeg,image/png"
    : [...SHOP_FILE_ALLOWED_EXTENSIONS, "application/pdf", "image/jpeg", "image/png"].join(",");

  function formatCatalogQuantity(quantity: number) {
    return stickerQuote ? formatShopStickerMetric(quantity) : String(quantity);
  }

  const selectionSummary = useMemo(() => {
    if (!selectedOption || !selectedQuantityOption) {
      return "";
    }

    return [
      page.title,
      `${optionSectionLabel}: ${selectedOption.label}`,
      selectedPaperSummary ? `Carta: ${selectedPaperSummary}` : null,
      selectedPaperSurchargePercent > 0 ? `Supplemento carta: +${selectedPaperSurchargePercent}%` : null,
      bannerQuote ? buildShopBannerSummaryLines(bannerQuote).join("\n") : null,
      stickerQuote ? buildShopStickerSummaryLines(stickerQuote).join("\n") : null,
      labelQuote ? buildShopLabelSummaryLines(labelQuote).join("\n") : null,
      stampCustomization
        ? [
            ...buildShopStampSummaryLines(stampCustomization),
            ...stampCustomization.lines.map((line, index) => `Riga ${index + 1}: ${line}`)
          ].join("\n")
        : null,
      usesFileCountQuantity ? `Foto caricate: ${uploadedFileCountQuantity}` : null,
      hasFileSubjects ? `Soggetti: ${fileSubjectQuantities.length}` : null,
      hasFileSubjects ? `Copie per file: ${fileSubjectQuantities.join(" + ")} pz` : null,
      stickerQuote
        ? `Area conteggiata: ${formatShopStickerMetric(selectedQuantityOption.quantity)} mq`
        : labelQuote
          ? `Etichette: ${selectedQuantityOption.quantity} pz`
        : `Quantità: ${selectedQuantityOption.quantity} pz`,
      `Totale: ${formatPrice(selectedTotalPriceCents || selectedQuantityOption.priceCents)}`,
      stampCustomization ? null : queuedFiles.length ? `File: ${queuedFiles.length}` : "File: da caricare"
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    page.title,
    fileSubjectQuantities,
    hasFileSubjects,
    optionSectionLabel,
    queuedFiles.length,
    bannerQuote,
    labelQuote,
    stickerQuote,
    stampCustomization,
    selectedOption,
    selectedPaperSummary,
    selectedPaperSurchargePercent,
    selectedQuantityOption,
    selectedTotalPriceCents,
    uploadedFileCountQuantity,
    usesFileCountQuantity
  ]);

  function selectOption(optionId: string) {
    const nextOption = page.options.find((option) => option.id === optionId);
    if (!nextOption) {
      return;
    }

    setSelectedId(nextOption.id);
    setSelectedQuantity(quantityMode === "unit-input" ? defaultUnitQuantity : nextOption.quantities[0]?.quantity || 0);
    if (nextOption.bannerPreset) {
      setBannerWidthDraft(formatBannerDraft(nextOption.bannerPreset.widthM));
      setBannerHeightDraft(formatBannerDraft(nextOption.bannerPreset.heightM));
      setBannerReinforced(nextOption.bannerPreset.reinforced);
    } else if (nextOption.bannerKind === "custom") {
      setBannerWidthDraft("1");
      setBannerHeightDraft("1");
      setBannerReinforced(true);
    }
  }

  function updateInputQuantity(value: string) {
    const minimumQuantity = labelQuote?.minimumQuantity || 1;
    const nextQuantity = Math.max(minimumQuantity, Math.round(Number(value) || minimumQuantity));
    setSelectedQuantity(nextQuantity);
  }

  function selectPaper(paperId: string) {
    const nextPaperChoice = page.paperChoices?.find((choice) => choice.id === paperId);
    if (!nextPaperChoice) {
      return;
    }

    setSelectedPaperId(nextPaperChoice.id);
    setSelectedPaperVariantId(nextPaperChoice.variants?.[0]?.id || "");
  }

  function appendFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) {
      return;
    }

    const defaultFileQuantity = usesFileCountQuantity ? 1 : selectedBaseQuantityOption?.quantity || 1;
    const nextErrors: string[] = [];
    const nextFiles: QueuedCatalogFile[] = [];

    files.forEach((file, index) => {
      const isPhotoFile =
        ["image/jpeg", "image/png"].includes(String(file.type || "").toLowerCase()) ||
        /\.(jpe?g|png)$/i.test(file.name);

      if (usesFileCountQuantity && !isPhotoFile) {
        nextErrors.push(`${file.name}: Per stampa foto carica JPG o PNG.`);
        return;
      }

      const validation = validateShopFileCandidate({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size
      });

      if (!validation.valid) {
        nextErrors.push(`${file.name}: ${validation.errors[0]}`);
        return;
      }

      nextFiles.push({
        error: null,
        file,
        id: buildQueuedCatalogFileId(file, index),
        quantity: defaultFileQuantity,
        status: "ready"
      });
    });

    setQueuedFiles((current) => [...current, ...nextFiles]);
    setNeedsFileChoice(false);
    setError(nextErrors[0] || null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeQueuedFile(fileId: string) {
    setQueuedFiles((current) => current.filter((entry) => entry.id !== fileId));
  }

  function updateQueuedFileQuantity(fileId: string, value: string) {
    const nextQuantity = Math.max(1, Math.round(Number(value) || 1));
    setQueuedFiles((current) =>
      current.map((entry) =>
        entry.id === fileId
          ? {
              ...entry,
              quantity: nextQuantity
            }
          : entry
      )
    );
  }

  function updateStampLineWeight(lineIndex: number, fontWeight: ShopStampFontWeight) {
    setStampLineWeights((current) => {
      const next = [...current];
      next[lineIndex] = fontWeight;
      return next;
    });
  }

  async function handleContinue(allowWithoutFiles = false) {
    if (!selectedOption || !selectedQuantityOption || isSubmitting || isRouting) {
      return;
    }

    if (stampCustomization && stampCustomization.lineCount <= 0) {
      setError("Inserisci il testo del timbro.");
      return;
    }

    if (stampCustomization?.overMaxLines) {
      setError("Il testo non entra nel timbro selezionato.");
      return;
    }

    if (!usesGeneratedFile && !queuedFiles.length && !allowWithoutFiles) {
      if (usesFileCountQuantity) {
        setError("Carica almeno una foto prima di continuare.");
        return;
      }

      setNeedsFileChoice(true);
      setError(null);
      return;
    }

    setIsSubmitting(true);
    setCreatedOrderPath(null);
    setError(null);
    setNeedsFileChoice(false);
    setQueuedFiles((current) => current.map((entry) => ({ ...entry, error: null, status: "ready" })));

    try {
      const sourcePath = typeof window !== "undefined" ? window.location.pathname : `/shop/servizi/${page.slug}`;
      const bannerSelection = bannerQuote
        ? {
            heightM: bannerQuote.heightM,
            material: bannerQuote.material,
            priceProfile: bannerQuote.priceProfile,
            quantity: bannerQuote.quantity,
            reinforced: bannerQuote.reinforced,
            widthM: bannerQuote.widthM
          }
        : null;
      const stampSelection = stampCustomization
        ? {
            fontSizePt: stampCustomization.fontSizePt,
            fontWeight: stampCustomization.fontWeight,
            lineWeights: stampCustomization.lineStyles.map((style) => style.fontWeight),
            model: stampCustomization.model.code,
            quantity: stampCustomization.quantity,
            text: stampCustomization.text
          }
        : null;
      const stickerSelection = stickerQuote
        ? {
            heightCm: stickerQuote.heightCm,
            material: stickerQuote.material,
            widthCm: stickerQuote.widthCm
          }
        : null;
      const labelSelection = labelQuote
        ? {
            heightCm: labelQuote.heightCm,
            material: labelQuote.material,
            pricePerSqmCents: labelQuote.pricePerSqmCents,
            quantity: labelQuote.quantity,
            widthCm: labelQuote.widthCm
          }
        : null;
      const catalogSelection =
        selectedPaperChoice ||
        supportsSubjects ||
        usesFileCountQuantity ||
        bannerSelection ||
        stampSelection ||
        stickerSelection ||
        labelSelection
          ? {
              banner: bannerSelection,
              copiesPerSubject: usesFileCountQuantity
                ? 1
                : hasFileSubjects
                  ? fileSubjectQuantities[0] || null
                  : supportsSubjects
                    ? selectedBaseQuantityOption?.quantity || null
                    : null,
              label: labelSelection,
              paperId: selectedPaperChoice?.id || null,
              paperVariantId: selectedPaperVariant?.id || null,
              stamp: stampSelection,
              sticker: stickerSelection,
              subjectCount: usesFileCountQuantity ? uploadedFileCountQuantity : supportsSubjects ? subjectCount : null,
              subjectPricingMode: usesFileCountQuantity ? "per-subject" : supportsSubjects ? subjectPricingMode : null,
              subjectQuantities: usesFileCountQuantity
                ? queuedFiles.map(() => 1)
                : hasFileSubjects
                  ? fileSubjectQuantities
                  : null
            }
          : undefined;
      const createdOrder = await createCatalogOrder({
        catalogSelection,
        configurationSummary: selectionSummary,
        customerNote,
        invoiceRequested: false,
        orderKind: "catalog",
        quantity: selectedQuantityOption.quantity,
        serviceId: selectedOption.serviceId || selectedOption.id,
        serviceLabel: selectedOption.orderLabel || selectedOption.label,
        sourcePath
      });

      let failedUploads = 0;
      if (stampCustomization) {
        try {
          await uploadCatalogOrderFile(
            createdOrder.orderId,
            createdOrder.salesOrderItemId,
            buildStampPdfFile(stampCustomization)
          );
        } catch {
          failedUploads += 1;
        }
      }
      const filesToUpload = queuedFiles;

      for (const entry of filesToUpload) {
        setQueuedFiles((current) =>
          current.map((queuedFile) =>
            queuedFile.id === entry.id
              ? {
                  ...queuedFile,
                  error: null,
                  status: "uploading"
                }
              : queuedFile
          )
        );

        try {
          await uploadCatalogOrderFile(createdOrder.orderId, createdOrder.salesOrderItemId, entry.file);
          setQueuedFiles((current) => current.filter((queuedFile) => queuedFile.id !== entry.id));
        } catch (uploadError) {
          failedUploads += 1;
          const message = getRequestErrorMessage(uploadError, "Upload file shop non riuscito.");
          setQueuedFiles((current) =>
            current.map((queuedFile) =>
              queuedFile.id === entry.id
                ? {
                    ...queuedFile,
                    error: message,
                    status: "error"
                  }
                : queuedFile
            )
          );
        }
      }

      if (failedUploads > 0) {
        setCreatedOrderPath(createdOrder.redirectPath);
        setError(
          failedUploads === 1
            ? "Ordine creato, ma 1 file non e stato caricato."
            : `Ordine creato, ma ${failedUploads} file non sono stati caricati.`
        );
        return;
      }

      startRouting(() => {
        router.push(`${createdOrder.redirectPath}?checkout=1`);
      });
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, "Ordine shop non creato."));
    } finally {
      setIsSubmitting(false);
    }
  }

  const canContinue = Boolean(
    selectedOption &&
      selectedQuantityOption &&
      (!usesFileCountQuantity || queuedFiles.length > 0) &&
      !stampCustomization?.overMaxLines &&
      !isSubmitting &&
      !isRouting
  );

  function renderFileSection() {
    if (usesGeneratedFile) {
      return null;
    }

    return (
      <div className="shop-business-card-section shop-catalog-file-section">
        <h2>{usesFileCountQuantity ? "Foto" : "File"}</h2>
        <input
          accept={fileInputAccept}
          className="shop-document-file-input"
          multiple
          onChange={(event) => appendFiles(event.currentTarget.files || [])}
          ref={fileInputRef}
          type="file"
        />
        <button
          className="shop-catalog-file-drop"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            appendFiles(event.dataTransfer.files);
          }}
          type="button"
        >
          <strong>
            {queuedFiles.length
              ? usesFileCountQuantity
                ? "Aggiungi foto"
                : "Aggiungi altro file"
              : usesFileCountQuantity
                ? "Carica foto"
                : "Carica file"}
          </strong>
          <span>{fileUploadHint}</span>
        </button>

        {queuedFiles.length ? (
          <div className="shop-catalog-file-list">
            {queuedFiles.map((entry) => (
              <article className={`shop-catalog-file-item is-${entry.status}`} key={entry.id}>
                <div className="shop-catalog-file-item-main">
                  <strong>{entry.file.name}</strong>
                  <span>{formatAttachmentSize(entry.file.size)}</span>
                  {entry.error ? <span>{entry.error}</span> : null}
                </div>
                {supportsSubjects && selectedOption ? (
                  quantityMode === "unit-input" ? (
                    <label className="shop-catalog-file-quantity">
                      <span>Copie</span>
                      <input
                        inputMode="numeric"
                        min={1}
                        onChange={(event) => updateQueuedFileQuantity(entry.id, event.currentTarget.value)}
                        step={1}
                        type="number"
                        value={entry.quantity || 1}
                      />
                    </label>
                  ) : (
                    <label className="shop-catalog-file-quantity">
                      <span>Copie</span>
                      <select
                        onChange={(event) => updateQueuedFileQuantity(entry.id, event.currentTarget.value)}
                        value={entry.quantity || selectedBaseQuantityOption?.quantity || 1}
                      >
                        {selectedOption.quantities.map((quantityOption) => (
                          <option key={quantityOption.quantity} value={quantityOption.quantity}>
                            {quantityOption.quantity}
                          </option>
                        ))}
                      </select>
                    </label>
                  )
                ) : usesFileCountQuantity ? (
                  <div className="shop-catalog-file-quantity is-readonly">
                    <span>Copie</span>
                    <strong>1</strong>
                  </div>
                ) : null}
                {entry.status !== "uploading" ? (
                  <button onClick={() => removeQueuedFile(entry.id)} type="button">
                    Rimuovi
                  </button>
                ) : (
                  <span>Carico</span>
                )}
              </article>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="shop-business-card-layout" aria-label={`Configuratore ${page.title}`}>
      <div className="shop-business-card-visual">
        <div className={`shop-business-card-photo-slot${selectedProductImage ? " has-image" : ""}`}>
          {selectedProductImage ? (
            <img alt={selectedProductImage.alt} decoding="async" src={selectedProductImage.src} />
          ) : (
            <span>Foto prodotto</span>
          )}
        </div>

        {page.hideTemplateCard ? null : (
          <div className="shop-business-card-template">
            <span>{page.templateLabel}</span>
            <strong>In arrivo</strong>
          </div>
        )}
      </div>

      <div className="shop-business-card-config">
        {usesFileCountQuantity ? renderFileSection() : null}

        {page.paperChoices?.length ? (
          <div className="shop-business-card-section shop-business-card-paper-section">
            <h2>Carta</h2>
            <div className="shop-business-card-paper-grid">
              {page.paperChoices.map((choice) => {
                const surchargePercent = Math.max(0, Math.round(((choice.priceMultiplier || 1) - 1) * 100));

                return (
                  <button
                    className={`shop-business-card-paper${selectedPaperChoice?.id === choice.id ? " is-selected" : ""}`}
                    key={choice.id}
                    onClick={() => selectPaper(choice.id)}
                    type="button"
                  >
                    <strong>{choice.label}</strong>
                    <span>{surchargePercent > 0 ? `${choice.note} · +${surchargePercent}%` : choice.note}</span>
                  </button>
                );
              })}
            </div>

            {selectedPaperChoice?.variants?.length ? (
              <div className="shop-business-card-paper-variant-grid" aria-label="Colore carta">
                {selectedPaperChoice.variants.map((variant) => (
                  <button
                    className={`shop-business-card-paper-variant${selectedPaperVariant?.id === variant.id ? " is-selected" : ""}`}
                    key={variant.id}
                    onClick={() => setSelectedPaperVariantId(variant.id)}
                    type="button"
                  >
                    {variant.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="shop-business-card-section">
          <h2>{optionSectionLabel}</h2>
          {page.options.length ? (
            <div className="shop-business-card-option-grid">
              {page.options.map((option) => (
                <button
                  className={`shop-business-card-option${selectedOption?.id === option.id ? " is-selected" : ""}`}
                  key={option.id}
                  onClick={() => selectOption(option.id)}
                  type="button"
                >
                  <strong>{option.label}</strong>
                  {option.description ? <em>{option.description}</em> : null}
                  {option.quantities[0] ? (
                    <span>
                      {isLabelCalculator || isStickerCalculator
                        ? `${formatPrice(applyShopCatalogPriceMultiplier(option.quantities[0].priceCents, priceMultiplier))} / mq`
                        : quantityMode === "unit-input"
                        ? `${formatPrice(applyShopCatalogPriceMultiplier(option.quantities[0].priceCents, priceMultiplier))} cad.`
                        : `Da ${formatPrice(applyShopCatalogPriceMultiplier(option.quantities[0].priceCents, priceMultiplier))}`}
                    </span>
                  ) : (
                    <span>Da verificare</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="shop-business-card-empty">Catalogo da completare.</div>
          )}
        </div>

        {stampCustomization && selectedOption?.stampSpec ? (
          <div className={`shop-business-card-section shop-stamp-text-section${stampCustomization.overMaxLines ? " is-over-limit" : ""}`}>
            <h2>Testo</h2>
            <div className="shop-stamp-editor">
              <div className="shop-stamp-preview-shell">
                <div
                  className="shop-stamp-preview"
                  style={{
                    aspectRatio: `${stampCustomization.model.widthMm} / ${stampCustomization.model.heightMm}`,
                    fontSize: `${Math.max(10, stampCustomization.fontSizePt * 1.45)}px`,
                    width: `${Math.round(stampCustomization.model.widthMm * 5.8)}px`
                  }}
                >
                  {stampCustomization.lines.length ? (
                    stampCustomization.lines.map((line, index) => (
                      <span
                        key={`${line}-${index}`}
                        style={{
                          fontWeight: stampCustomization.lineStyles[index]?.fontWeight === "bold" ? 800 : 400
                        }}
                      >
                        {line || "\u00a0"}
                      </span>
                    ))
                  ) : (
                    <span>Anteprima timbro</span>
                  )}
                </div>
              </div>
              <div className="shop-stamp-controls" aria-label="Formato testo timbro">
                <label>
                  <span>Pt</span>
                  <input
                    inputMode="decimal"
                    max={12}
                    min={5}
                    onChange={(event) => setStampFontSizePt(Number(event.currentTarget.value) || SHOP_STAMP_DEFAULT_FONT_SIZE_PT)}
                    step={0.5}
                    type="number"
                    value={stampFontSizePt}
                  />
                </label>
              </div>
            </div>
            <textarea
              onChange={(event) => setStampTextDraft(event.currentTarget.value)}
              placeholder="Scrivi il testo del timbro"
              rows={Math.min(8, Math.max(2, selectedOption.stampSpec.maxLines))}
              value={stampTextDraft}
            />
            {stampCustomization.lines.length ? (
              <div className="shop-stamp-line-format-list" aria-label="Formato righe timbro">
                {stampCustomization.lines.map((line, index) => {
                  const activeWeight = stampCustomization.lineStyles[index]?.fontWeight || "regular";

                  return (
                    <div className="shop-stamp-line-format" key={`${line}-${index}`}>
                      <span>Riga {index + 1}</span>
                      <strong>{line || "Vuota"}</strong>
                      <div className="shop-stamp-line-format-actions">
                        <button
                          className={activeWeight === "regular" ? "is-selected" : ""}
                          onClick={() => updateStampLineWeight(index, "regular")}
                          type="button"
                        >
                          Regular
                        </button>
                        <button
                          className={activeWeight === "bold" ? "is-selected" : ""}
                          onClick={() => updateStampLineWeight(index, "bold")}
                          type="button"
                        >
                          Bold
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="shop-stamp-info-strip">
              <span>
                {stampCustomization.lineCount}/{stampCustomization.maxLines} righe
              </span>
              <span>Gommina {formatPrice(stampCustomization.rubberUnitCents)} cad.</span>
              {stampCustomization.overMaxLines ? <span>Riduci testo</span> : null}
            </div>
          </div>
        ) : null}

        {bannerQuote ? (
          <div className="shop-business-card-section shop-banner-size-section">
            <h2>Misure</h2>
            {selectedOption?.bannerKind === "custom" ? (
              <div className="shop-banner-size-grid">
                <label className="shop-banner-size-field">
                  <span>Larghezza m</span>
                  <input
                    inputMode="decimal"
                    min="0.1"
                    onBlur={() => setBannerWidthDraft(formatBannerDraft(bannerQuote.widthM))}
                    onChange={(event) => setBannerWidthDraft(event.currentTarget.value)}
                    type="text"
                    value={bannerWidthDraft}
                  />
                </label>
                <label className="shop-banner-size-field">
                  <span>Altezza m</span>
                  <input
                    inputMode="decimal"
                    max={SHOP_BANNER_MAX_HEIGHT_M}
                    min="0.1"
                    onBlur={() => setBannerHeightDraft(formatBannerDraft(bannerQuote.heightM))}
                    onChange={(event) => setBannerHeightDraft(event.currentTarget.value)}
                    type="text"
                    value={bannerHeightDraft}
                  />
                </label>
                <button
                  className={`shop-banner-reinforcement${bannerReinforced ? " is-selected" : ""}`}
                  onClick={() => setBannerReinforced((current) => !current)}
                  type="button"
                >
                  Rinforzo
                </button>
              </div>
            ) : (
              <div className="shop-banner-standard-card">
                <span>Formato</span>
                <strong>
                  {formatShopBannerMetric(bannerQuote.widthM)}x{formatShopBannerMetric(bannerQuote.heightM)} m
                </strong>
              </div>
            )}
            <div className="shop-banner-calculation-strip">
              <span>{getShopBannerMaterialLabel(bannerQuote.material)}</span>
              <span>{formatShopBannerMetric(bannerQuote.areaSqm)} mq</span>
              <span>{bannerQuote.eyeletCount} occhielli</span>
              <span>{bannerQuote.reinforced ? "Rinforzato" : "Non rinforzato"}</span>
            </div>
          </div>
        ) : null}

        {stickerQuote ? (
          <div className="shop-business-card-section shop-sticker-size-section">
            <h2>Misure</h2>
            <div className="shop-sticker-size-grid">
              <label className="shop-sticker-size-field">
                <span>Larghezza cm</span>
                <input
                  inputMode="decimal"
                  min="1"
                  onBlur={() => setStickerWidthDraft(formatShopStickerMetric(stickerQuote.widthCm))}
                  onChange={(event) => setStickerWidthDraft(event.currentTarget.value)}
                  type="text"
                  value={stickerWidthDraft}
                />
              </label>
              <label className="shop-sticker-size-field">
                <span>Altezza cm</span>
                <input
                  inputMode="decimal"
                  min="1"
                  onBlur={() => setStickerHeightDraft(formatShopStickerMetric(stickerQuote.heightCm))}
                  onChange={(event) => setStickerHeightDraft(event.currentTarget.value)}
                  type="text"
                  value={stickerHeightDraft}
                />
              </label>
            </div>
            <div className="shop-sticker-calculation-strip">
              <span>{getShopStickerMaterialLabel(stickerQuote.material)}</span>
              <span>{formatPrice(stickerQuote.pricePerSqmCents)} / mq</span>
              <span>{formatShopStickerMetric(stickerQuote.areaSqm)} mq reali</span>
              <span>{formatShopStickerMetric(stickerQuote.billableSqm)} mq conteggiati</span>
            </div>
          </div>
        ) : null}

        {labelQuote ? (
          <div className="shop-business-card-section shop-label-size-section">
            <h2>Formato etichetta</h2>
            <div className="shop-label-size-grid">
              <label className="shop-label-size-field">
                <span>Larghezza cm</span>
                <input
                  inputMode="decimal"
                  min="1"
                  onBlur={() => setLabelWidthDraft(formatShopLabelMetric(labelQuote.widthCm))}
                  onChange={(event) => setLabelWidthDraft(event.currentTarget.value)}
                  type="text"
                  value={labelWidthDraft}
                />
              </label>
              <label className="shop-label-size-field">
                <span>Altezza cm</span>
                <input
                  inputMode="decimal"
                  min="1"
                  onBlur={() => setLabelHeightDraft(formatShopLabelMetric(labelQuote.heightCm))}
                  onChange={(event) => setLabelHeightDraft(event.currentTarget.value)}
                  type="text"
                  value={labelHeightDraft}
                />
              </label>
            </div>
            <div className="shop-label-calculation-strip">
              <span>{getShopLabelMaterialLabel(labelQuote.material)}</span>
              <span>{formatPrice(labelQuote.pricePerSqmCents)} / mq</span>
              <span>Min {labelQuote.minimumQuantity} etichette</span>
              <span>{formatShopLabelMetric(labelQuote.billableSqm)} mq conteggiati</span>
            </div>
          </div>
        ) : null}

        {selectedOption && !hasFileSubjects && !stickerQuote && !usesFileCountQuantity ? (
          <div className="shop-business-card-section">
            <h2>Quantità</h2>
            {quantityMode === "unit-input" ? (
              <label className="shop-catalog-quantity-input-card">
                <span>{quantityInputLabel}</span>
                <input
                  inputMode="numeric"
                  min={labelQuote?.minimumQuantity || 1}
                  onChange={(event) => updateInputQuantity(event.currentTarget.value)}
                  step={1}
                  type="number"
                  value={labelQuote ? Math.max(selectedQuantity || labelQuote.minimumQuantity, labelQuote.minimumQuantity) : selectedQuantity || 1}
                />
                <strong>
                  {selectedTotalPriceCents !== null ? formatPrice(selectedTotalPriceCents) : "Da verificare"}
                </strong>
              </label>
            ) : (
              <div className="shop-business-card-quantity-grid">
                {selectedOption.quantities.map((quantity) => (
                  <button
                    className={`shop-business-card-quantity${selectedQuantityOption?.quantity === quantity.quantity ? " is-selected" : ""}`}
                    key={quantity.quantity}
                    onClick={() => setSelectedQuantity(quantity.quantity)}
                    type="button"
                  >
                  <strong>{quantity.quantity}</strong>
                  <span>{formatPrice(applyShopCatalogPriceMultiplier(quantity.priceCents, priceMultiplier))}</span>
                </button>
              ))}
            </div>
            )}
          </div>
        ) : null}

        {!usesFileCountQuantity ? renderFileSection() : null}

        <aside className="shop-business-card-summary shop-catalog-order-summary" aria-label={`Riepilogo ${page.title}`}>
          <div className="shop-catalog-summary-total">
            <span>Totale</span>
            <strong>{selectedTotalPriceCents !== null ? formatPrice(selectedTotalPriceCents) : "Da verificare"}</strong>
          </div>
          {selectedPaperSummary ? (
            <div className="shop-catalog-summary-detail">
              <span>Carta</span>
              <strong>{selectedPaperSummary}</strong>
            </div>
          ) : null}
          {bannerQuote ? (
            <div className="shop-catalog-summary-detail">
              <span>Misure</span>
              <strong>
                {formatShopBannerMetric(bannerQuote.widthM)}x{formatShopBannerMetric(bannerQuote.heightM)} m ·{" "}
                {formatShopBannerMetric(bannerQuote.areaSqm)} mq
              </strong>
            </div>
          ) : null}
          {stickerQuote ? (
            <div className="shop-catalog-summary-detail">
              <span>Misure</span>
              <strong>{formatShopStickerMetric(stickerQuote.widthCm)}x{formatShopStickerMetric(stickerQuote.heightCm)} cm</strong>
              <em>{formatShopStickerMetric(stickerQuote.billableSqm)} mq conteggiati</em>
            </div>
          ) : null}
          {labelQuote ? (
            <div className="shop-catalog-summary-detail">
              <span>Formato</span>
              <strong>{formatShopLabelMetric(labelQuote.widthCm)}x{formatShopLabelMetric(labelQuote.heightCm)} cm</strong>
              <em>
                {labelQuote.quantity} pz · {formatShopLabelMetric(labelQuote.billableSqm)} mq conteggiati
              </em>
            </div>
          ) : null}
          {stampCustomization ? (
            <div className="shop-catalog-summary-detail">
              <span>Timbro</span>
              <strong>
                {stampCustomization.model.displaySize} · {stampCustomization.lineCount} righe
              </strong>
            </div>
          ) : null}
          <div className="shop-catalog-summary-detail shop-catalog-summary-choice">
            <span>Scelta</span>
            <strong>{selectedOption?.label || page.title}</strong>
            {usesFileCountQuantity ? (
              <em>
                {uploadedFileCountQuantity} foto · {selectedQuantityOption?.quantity || 0} pz
              </em>
            ) : hasFileSubjects ? (
              <em>
                {fileSubjectQuantities.length} file · {selectedQuantityOption?.quantity || 0} pz
              </em>
            ) : selectedQuantityOption ? (
              <em>
                {formatCatalogQuantity(selectedQuantityOption.quantity)} {quantityUnitLabel}
              </em>
            ) : null}
          </div>

          <div className="shop-catalog-order-actions">
            {error ? (
              <div className="shop-catalog-order-error">
                <span>{error}</span>
                {createdOrderPath ? (
                  <button
                    onClick={() => {
                      startRouting(() => {
                        router.push(createdOrderPath);
                      });
                    }}
                    type="button"
                  >
                    Apri ordine
                  </button>
                ) : null}
              </div>
            ) : null}

            {needsFileChoice ? (
              <div className="shop-catalog-file-choice">
                <button onClick={() => fileInputRef.current?.click()} type="button">
                  Carica ora
                </button>
                <button onClick={() => void handleContinue(true)} type="button">
                  Lo carico dopo
                </button>
              </div>
            ) : null}

            <label className="shop-catalog-note-field">
              <span>Note</span>
              <textarea
                onChange={(event) => setCustomerNote(event.currentTarget.value)}
                placeholder="Solo se serve"
                rows={2}
                value={customerNote}
              />
            </label>

            <button
              className="shop-catalog-continue-button"
              disabled={!canContinue}
              onClick={() => void handleContinue(false)}
              type="button"
            >
              {isSubmitting || isRouting ? "Continuo..." : "Continua"}
            </button>
          </div>
        </aside>
      </div>

      <div className="shop-catalog-mobile-bar" aria-label={`Riepilogo rapido ${page.title}`}>
        <div>
          <span>Totale</span>
          <strong>{selectedTotalPriceCents !== null ? formatPrice(selectedTotalPriceCents) : "Da verificare"}</strong>
        </div>
        <button disabled={!canContinue} onClick={() => void handleContinue(false)} type="button">
          {isSubmitting || isRouting ? "..." : "Continua"}
        </button>
      </div>
    </section>
  );
}
