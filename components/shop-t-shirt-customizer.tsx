"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type PointerEvent
} from "react";
import { formatAttachmentMaxSize, formatAttachmentSize } from "@/lib/attachment-utils";
import {
  SHOP_FILE_ALLOWED_EXTENSIONS,
  SHOP_FILE_ALLOWED_MIME_TYPES,
  SHOP_FILE_MAX_SIZE_BYTES,
  validateShopFileCandidate
} from "@/lib/domain/files/shop-file-assets";
import type { ShopCatalogProductPage } from "@/lib/shop-product-pages";

type ShopTShirtCustomizerProps = {
  page: ShopCatalogProductPage;
};

type CreateCatalogOrderResponse = {
  orderId: string;
  redirectPath: string;
  salesOrderItemId: string | null;
  success: true;
};

type TShirtColor = "black" | "white";
type TShirtView = "back" | "front" | "side";

type TShirtPlacement = {
  area: {
    height: number;
    left: number;
    top: number;
    width: number;
  };
  id: string;
  label: string;
  shortLabel: string;
  view: TShirtView;
};

type DragState = {
  originX: number;
  originY: number;
  startX: number;
  startY: number;
};

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  currency: "EUR",
  style: "currency"
});

const colorOptions: Array<{ id: TShirtColor; label: string }> = [
  { id: "white", label: "Bianca" },
  { id: "black", label: "Nera" }
];

const whiteMockupImages: Record<Exclude<TShirtView, "side">, string> = {
  front: "/shop/mockups/tshirt-white-front.jpg",
  back: "/shop/mockups/tshirt-white-back.jpg"
};

const sideMockupImage = "/shop/mockups/tshirt-side-neutral.jpg";

const sizeOptions = ["S", "M", "L", "XL", "XXL"];

const placements: TShirtPlacement[] = [
  {
    id: "front",
    label: "Davanti",
    shortLabel: "Davanti",
    view: "front",
    area: { left: 52, top: 52, width: 34, height: 40 }
  },
  {
    id: "back",
    label: "Schiena",
    shortLabel: "Schiena",
    view: "back",
    area: { left: 51, top: 50, width: 36, height: 43 }
  },
  {
    id: "heart",
    label: "Lato cuore",
    shortLabel: "Cuore",
    view: "front",
    area: { left: 60, top: 37, width: 13, height: 13 }
  },
  {
    id: "right-chest",
    label: "Lato destro",
    shortLabel: "Destro",
    view: "front",
    area: { left: 44, top: 37, width: 13, height: 13 }
  },
  {
    id: "right-sleeve",
    label: "Manica dx",
    shortLabel: "Manica dx",
    view: "side",
    area: { left: 52, top: 38, width: 24, height: 17 }
  },
  {
    id: "left-sleeve",
    label: "Manica sx",
    shortLabel: "Manica sx",
    view: "side",
    area: { left: 52, top: 38, width: 24, height: 17 }
  },
  {
    id: "back-neck",
    label: "Retro sotto colletto",
    shortLabel: "Retro collo",
    view: "back",
    area: { left: 51, top: 19, width: 21, height: 10 }
  }
];

function getViewLabel(view: TShirtView) {
  if (view === "back") {
    return "Retro";
  }

  if (view === "side") {
    return "Profilo";
  }

  return "Fronte";
}

function formatPrice(cents: number) {
  return currencyFormatter.format(cents / 100);
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeQuantity(value: string | number) {
  return Math.max(1, Math.round(Number(value) || 1));
}

function resolveQuantityPrice(
  option: ShopCatalogProductPage["options"][number] | null,
  quantity: number
) {
  if (!option?.quantities.length) {
    return null;
  }

  const safeQuantity = normalizeQuantity(quantity);
  const sortedQuantities = [...option.quantities].sort((first, second) => first.quantity - second.quantity);
  const matchedQuantity =
    sortedQuantities.find((quantityOption) => quantityOption.quantity === safeQuantity) ||
    [...sortedQuantities].reverse().find((quantityOption) => quantityOption.quantity <= safeQuantity) ||
    sortedQuantities[0];
  const unitPriceCents = Math.round(matchedQuantity.priceCents / Math.max(1, matchedQuantity.quantity));

  return {
    priceCents: unitPriceCents * safeQuantity,
    quantity: safeQuantity,
    unitPriceCents
  };
}

async function createCatalogOrder(payload: {
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

function isPrintableTShirtOption(option: ShopCatalogProductPage["options"][number]) {
  const code = String(option.code || "").toUpperCase();
  const label = option.label.toLowerCase();
  return !code.includes("NEUTRA") && !code.includes("SOLO_STAMPA") && !label.includes("neutra") && !label.includes("solo stampa");
}

export function ShopTShirtCustomizer({ page }: ShopTShirtCustomizerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const options = useMemo(() => page.options.filter(isPrintableTShirtOption), [page.options]);
  const firstOption = options[0] || page.options[0] || null;
  const [selectedId, setSelectedId] = useState(firstOption?.id || "");
  const selectedOption = options.find((option) => option.id === selectedId) || firstOption;
  const [selectedColor, setSelectedColor] = useState<TShirtColor>("white");
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedPlacementId, setSelectedPlacementId] = useState(placements[0].id);
  const selectedPlacement = placements.find((placement) => placement.id === selectedPlacementId) || placements[0];
  const [quantity, setQuantity] = useState(1);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(null);
  const [artworkOffset, setArtworkOffset] = useState({ x: 0, y: 0 });
  const [artworkScale, setArtworkScale] = useState(1);
  const [customerNote, setCustomerNote] = useState("");
  const [createdOrderPath, setCreatedOrderPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRouting, startRouting] = useTransition();

  const selectedPrice = useMemo(() => resolveQuantityPrice(selectedOption, quantity), [quantity, selectedOption]);

  useEffect(() => {
    if (!artworkFile || !artworkFile.type.startsWith("image/")) {
      setArtworkPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(artworkFile);
    setArtworkPreviewUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [artworkFile]);

  function selectPlacement(placementId: string) {
    setSelectedPlacementId(placementId);
    setArtworkOffset({ x: 0, y: 0 });
    setArtworkScale(1);
  }

  function resetArtworkTransform() {
    setArtworkOffset({ x: 0, y: 0 });
    setArtworkScale(1);
  }

  function readArtworkFile(fileList: FileList | File[]) {
    const file = Array.from(fileList)[0] || null;
    if (!file) {
      return;
    }

    const validation = validateShopFileCandidate({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size
    });

    if (!validation.valid) {
      setError(`${file.name}: ${validation.errors[0]}`);
      return;
    }

    setArtworkFile(file);
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleArtworkPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!artworkFile) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      originX: artworkOffset.x,
      originY: artworkOffset.y,
      startX: event.clientX,
      startY: event.clientY
    };
  }

  function handleArtworkPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current || !printAreaRef.current) {
      return;
    }

    const bounds = printAreaRef.current.getBoundingClientRect();
    const deltaX = ((event.clientX - dragRef.current.startX) / Math.max(1, bounds.width)) * 100;
    const deltaY = ((event.clientY - dragRef.current.startY) / Math.max(1, bounds.height)) * 100;

    setArtworkOffset({
      x: clamp(dragRef.current.originX + deltaX, -70, 70),
      y: clamp(dragRef.current.originY + deltaY, -70, 70)
    });
  }

  function handleArtworkPointerEnd() {
    dragRef.current = null;
  }

  const printAreaStyle = {
    height: `${selectedPlacement.area.height}%`,
    left: `${selectedPlacement.area.left}%`,
    top: `${selectedPlacement.area.top}%`,
    width: `${selectedPlacement.area.width}%`
  } satisfies CSSProperties;

  const artworkStyle = {
    left: `${50 + artworkOffset.x}%`,
    top: `${50 + artworkOffset.y}%`,
    transform: `translate(-50%, -50%) scale(${artworkScale})`
  } satisfies CSSProperties;

  const selectedColorLabel = colorOptions.find((color) => color.id === selectedColor)?.label || "Bianca";
  const mockupPhotoSrc =
    selectedPlacement.view === "side"
      ? sideMockupImage
      : selectedColor === "white"
        ? whiteMockupImages[selectedPlacement.view]
        : null;
  const canContinue = Boolean(selectedOption && selectedPrice && artworkFile && !isSubmitting && !isRouting);
  const configurationSummary = [
    page.title,
    selectedOption ? `Prodotto: ${selectedOption.label}` : null,
    `Colore maglietta: ${selectedColorLabel}`,
    `Taglia: ${selectedSize}`,
    `Posizione stampa: ${selectedPlacement.label}`,
    "Area massima stampa: 30x40 cm",
    `Mockup: scala ${artworkScale.toFixed(2)}x, spostamento ${artworkOffset.x.toFixed(0)}% / ${artworkOffset.y.toFixed(0)}%`,
    selectedPrice ? `Quantita: ${selectedPrice.quantity} pz` : null,
    selectedPrice ? `Totale: ${formatPrice(selectedPrice.priceCents)}` : null,
    artworkFile ? `File: ${artworkFile.name}` : "File: da caricare"
  ]
    .filter(Boolean)
    .join("\n");

  async function handleContinue() {
    if (!selectedOption || !selectedPrice || isSubmitting || isRouting) {
      return;
    }

    if (!artworkFile) {
      setError("Carica la grafica prima di continuare.");
      return;
    }

    setIsSubmitting(true);
    setCreatedOrderPath(null);
    setError(null);

    try {
      const sourcePath = typeof window !== "undefined" ? window.location.pathname : "/shop/servizi/t-shirt-personalizzate";
      const createdOrder = await createCatalogOrder({
        configurationSummary,
        customerNote,
        invoiceRequested: false,
        orderKind: "catalog",
        quantity: selectedPrice.quantity,
        serviceId: selectedOption.serviceId || selectedOption.id,
        serviceLabel: selectedOption.orderLabel || selectedOption.label,
        sourcePath
      });

      try {
        await uploadCatalogOrderFile(createdOrder.orderId, createdOrder.salesOrderItemId, artworkFile);
      } catch (uploadError) {
        setCreatedOrderPath(createdOrder.redirectPath);
        setError(getRequestErrorMessage(uploadError, "Ordine creato, ma il file non e stato caricato."));
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

  return (
    <section className="shop-tshirt-customizer" aria-label="Configuratore t-shirt personalizzate">
      <div className="shop-tshirt-visual">
        <div className="shop-tshirt-preview-card">
          <div className="shop-tshirt-preview-head">
            <span>{getViewLabel(selectedPlacement.view)}</span>
            <strong>{selectedPlacement.label}</strong>
          </div>
          <div className={`shop-tshirt-mockup${mockupPhotoSrc ? " has-photo" : " has-vector"} is-${selectedColor} is-${selectedPlacement.view}${selectedPlacement.id === "left-sleeve" ? " is-left-sleeve" : ""}`}>
            {mockupPhotoSrc ? (
              <img
                alt={`Mockup maglietta ${getViewLabel(selectedPlacement.view).toLowerCase()}`}
                className="shop-tshirt-photo-mockup"
                draggable={false}
                src={mockupPhotoSrc}
              />
            ) : (
              <svg aria-hidden="true" className="shop-tshirt-base" viewBox="0 0 420 520">
                <path className="shop-tshirt-shadow" d="M76 138 154 66h112l78 72-48 86-45-26v252H169V198l-45 26-48-86Z" />
                <path className="shop-tshirt-shape" d="M78 132 154 62h112l76 70-48 88-46-26v260H172V194l-46 26-48-88Z" />
                <path className="shop-tshirt-neck" d="M166 63c8 38 80 38 88 0H166Z" />
                <path className="shop-tshirt-seam" d="M166 88c27 22 61 22 88 0" />
                <path className="shop-tshirt-seam" d="M126 220 78 132" />
                <path className="shop-tshirt-seam" d="M294 220 342 132" />
              </svg>
            )}
            <div
              className="shop-tshirt-print-area"
              ref={printAreaRef}
              style={printAreaStyle}
              onPointerDown={handleArtworkPointerDown}
              onPointerMove={handleArtworkPointerMove}
              onPointerUp={handleArtworkPointerEnd}
              onPointerCancel={handleArtworkPointerEnd}
            >
              {artworkPreviewUrl ? (
                <img alt="Anteprima grafica caricata" className="shop-tshirt-artwork" draggable={false} src={artworkPreviewUrl} style={artworkStyle} />
              ) : artworkFile ? (
                <div className="shop-tshirt-artwork-placeholder" style={artworkStyle}>
                  <strong>PDF</strong>
                  <span>{artworkFile.name}</span>
                </div>
              ) : (
                <div className="shop-tshirt-empty-artwork">Carica grafica</div>
              )}
            </div>
          </div>
          <div className="shop-tshirt-preview-help">Trascina la grafica nell'area evidenziata.</div>
        </div>
      </div>

      <div className="shop-tshirt-config">
        <div className="shop-business-card-section">
          <h2>Prodotto</h2>
          {options.length ? (
            <div className="shop-business-card-option-grid shop-tshirt-option-grid">
              {options.map((option) => {
                const quote = resolveQuantityPrice(option, quantity);

                return (
                  <button
                    className={`shop-business-card-option${selectedOption?.id === option.id ? " is-selected" : ""}`}
                    key={option.id}
                    onClick={() => setSelectedId(option.id)}
                    type="button"
                  >
                    <strong>{option.label}</strong>
                    <span>{quote ? `${formatPrice(quote.unitPriceCents)} cad.` : "Da verificare"}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="shop-business-card-empty">Catalogo t-shirt da completare.</div>
          )}
        </div>

        <div className="shop-business-card-section">
          <h2>Maglietta</h2>
          <div className="shop-tshirt-choice-grid">
            {colorOptions.map((color) => (
              <button
                className={`shop-tshirt-choice is-${color.id}${selectedColor === color.id ? " is-selected" : ""}`}
                key={color.id}
                onClick={() => setSelectedColor(color.id)}
                type="button"
              >
                <span>{color.label}</span>
              </button>
            ))}
          </div>
          <div className="shop-tshirt-size-grid">
            {sizeOptions.map((size) => (
              <button
                className={`shop-tshirt-size${selectedSize === size ? " is-selected" : ""}`}
                key={size}
                onClick={() => setSelectedSize(size)}
                type="button"
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="shop-business-card-section">
          <h2>Posizione stampa</h2>
          <div className="shop-tshirt-placement-grid">
            {placements.map((placement) => (
              <button
                className={`shop-tshirt-placement${selectedPlacement.id === placement.id ? " is-selected" : ""}`}
                key={placement.id}
                onClick={() => selectPlacement(placement.id)}
                type="button"
              >
                <strong>{placement.shortLabel}</strong>
                <span>{getViewLabel(placement.view)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="shop-business-card-section shop-tshirt-upload-section">
          <h2>Grafica</h2>
          <input
            accept={[...SHOP_FILE_ALLOWED_EXTENSIONS, ...SHOP_FILE_ALLOWED_MIME_TYPES].join(",")}
            className="shop-document-file-input"
            onChange={(event) => readArtworkFile(event.currentTarget.files || [])}
            ref={fileInputRef}
            type="file"
          />
          <button
            className="shop-tshirt-upload"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              event.preventDefault();
              readArtworkFile(event.dataTransfer.files);
            }}
            type="button"
          >
            <strong>{artworkFile ? "Sostituisci grafica" : "Carica grafica"}</strong>
            <span>PDF, JPG o PNG, max {formatAttachmentMaxSize(SHOP_FILE_MAX_SIZE_BYTES)}</span>
          </button>
          {artworkFile ? (
            <div className="shop-tshirt-file-meta">
              <strong>{artworkFile.name}</strong>
              <span>{formatAttachmentSize(artworkFile.size)}</span>
            </div>
          ) : null}
        </div>

        <div className="shop-business-card-section">
          <h2>Adatta grafica</h2>
          <label className="shop-tshirt-slider-row">
            <span>Scala</span>
            <input
              max="2.4"
              min="0.35"
              onChange={(event) => setArtworkScale(Number(event.currentTarget.value) || 1)}
              step="0.05"
              type="range"
              value={artworkScale}
            />
            <strong>{Math.round(artworkScale * 100)}%</strong>
          </label>
          <button className="shop-tshirt-reset-button" onClick={resetArtworkTransform} type="button">
            Reimposta posizione
          </button>
        </div>

        <aside className="shop-business-card-summary shop-catalog-order-summary shop-tshirt-summary" aria-label="Riepilogo t-shirt">
          <div className="shop-catalog-summary-total">
            <span>Totale</span>
            <strong>{selectedPrice ? formatPrice(selectedPrice.priceCents) : "Da verificare"}</strong>
          </div>
          <label className="shop-catalog-quantity-input-card">
            <span>Quantità</span>
            <input
              inputMode="numeric"
              min={1}
              onChange={(event) => setQuantity(normalizeQuantity(event.currentTarget.value))}
              step={1}
              type="number"
              value={quantity}
            />
            <strong>{selectedPrice ? formatPrice(selectedPrice.unitPriceCents) : "-"}</strong>
          </label>
          <div className="shop-catalog-summary-detail shop-catalog-summary-choice">
            <span>Scelta</span>
            <strong>{selectedColorLabel} · {selectedSize}</strong>
            <em>{selectedPlacement.label}</em>
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
              onClick={() => void handleContinue()}
              type="button"
            >
              {isSubmitting || isRouting ? "Continuo..." : "Continua"}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
