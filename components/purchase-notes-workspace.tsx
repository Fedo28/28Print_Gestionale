"use client";

import type { PurchaseNoteUrgency } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { CustomerAutocomplete, type CustomerAutocompleteOption } from "@/components/customer-autocomplete";
import { MaterialCategorySelectorField } from "@/components/material-category-selector-field";
import { PageHeader } from "@/components/page-header";
import { operationalStatusLabels, orderMaterialCategoryOptions, purchaseNoteUrgencyLabels } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import {
  buildOrderMaterialNoteContent,
  createEmptyOrderMaterialCategoryCounts,
  getOrderMaterialCategoryEntries,
  parseOrderMaterialNoteContent,
  type OrderMaterialCategoryKey
} from "@/lib/order-material-note";
import {
  type PurchaseNoteView,
  normalizePurchaseNoteContent,
  normalizePurchaseNoteCustomerName,
  sortCompletedPurchaseNotes,
  sortPendingPurchaseNotes
} from "@/lib/purchase-note-utils";

type PurchaseNotesWorkspaceProps = {
  customers: CustomerAutocompleteOption[];
  pendingNotes: PurchaseNoteView[];
  completedNotes: PurchaseNoteView[];
  createAction: (formData: FormData) => Promise<PurchaseNoteView>;
  updateAction: (formData: FormData) => Promise<PurchaseNoteView>;
  deleteAction: (formData: FormData) => Promise<{ id: string; orderId: string | null }>;
  completeAction: (formData: FormData) => Promise<PurchaseNoteView>;
  reopenAction: (formData: FormData) => Promise<PurchaseNoteView>;
};

type FeedbackState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

type NotesTab = "pending" | "completed";
type DrawerMode = "create" | "edit";

const EXIT_ANIMATION_MS = 320;
const DEFAULT_URGENCY: PurchaseNoteUrgency = "NORMALE";

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function getUrgencyToneClass(value: PurchaseNoteUrgency) {
  switch (value) {
    case "BLOCCANTE":
      return "danger";
    case "URGENTE":
      return "warning";
    default:
      return "status";
  }
}

function buildOrderLinkLabel(note: PurchaseNoteView) {
  if (!note.order) {
    return null;
  }

  return `${note.order.orderCode} • ${note.order.title}`;
}

function matchesCategoryFilter(note: PurchaseNoteView, categoryKey: OrderMaterialCategoryKey | "") {
  if (!categoryKey) {
    return true;
  }

  const parsedMaterialNote = parseOrderMaterialNoteContent(note.content);
  return parsedMaterialNote.categoryCounts[categoryKey].trim().length > 0;
}

export function PurchaseNotesWorkspace({
  customers,
  pendingNotes,
  completedNotes,
  createAction,
  updateAction,
  deleteAction,
  completeAction,
  reopenAction
}: PurchaseNotesWorkspaceProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(pendingNotes.length === 0 && completedNotes.length === 0);
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [materialCategoryCounts, setMaterialCategoryCounts] = useState(() => createEmptyOrderMaterialCategoryCounts());
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<OrderMaterialCategoryKey | "">("");
  const [urgency, setUrgency] = useState<PurchaseNoteUrgency>(DEFAULT_URGENCY);
  const [activeTab, setActiveTab] = useState<NotesTab>("pending");
  const [visiblePendingNotes, setVisiblePendingNotes] = useState(pendingNotes);
  const [visibleCompletedNotes, setVisibleCompletedNotes] = useState(completedNotes);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [busyNoteIds, setBusyNoteIds] = useState<string[]>([]);
  const [slidingNoteIds, setSlidingNoteIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const selectedCustomer =
    selectedCustomerId ? customers.find((customer) => customer.id === selectedCustomerId) ?? null : null;
  const normalizedCustomerQuery = normalizePurchaseNoteCustomerName(customerQuery);
  const materialCategoryEntries = getOrderMaterialCategoryEntries(materialCategoryCounts);
  const normalizedContent = normalizePurchaseNoteContent(
    buildOrderMaterialNoteContent({
      content,
      categoryEntries: materialCategoryEntries
    })
  );
  const filteredPendingNotes = visiblePendingNotes.filter((note) => matchesCategoryFilter(note, activeCategoryFilter));
  const filteredCompletedNotes = visibleCompletedNotes.filter((note) => matchesCategoryFilter(note, activeCategoryFilter));
  const canSubmit = normalizedCustomerQuery.length > 0 && normalizedContent.length > 0;
  const pendingCount = filteredPendingNotes.length;
  const completedCount = filteredCompletedNotes.length;
  const editingNote =
    editingNoteId
      ? [...visiblePendingNotes, ...visibleCompletedNotes].find((entry) => entry.id === editingNoteId) ?? null
      : null;
  const isDrawerLinkedToOrder = drawerMode === "edit" && Boolean(editingNote?.order);
  const drawerTitle = drawerMode === "edit" ? "Modifica nota ordine" : "Nuova nota ordine";
  const drawerSubmitLabel = drawerMode === "edit" ? "Salva modifiche" : "Salva nota";
  const activeListCount = activeTab === "pending" ? filteredPendingNotes.length : filteredCompletedNotes.length;
  const activeListTotalCount = activeTab === "pending" ? visiblePendingNotes.length : visibleCompletedNotes.length;

  useEffect(() => {
    setVisiblePendingNotes(pendingNotes);
  }, [pendingNotes]);

  useEffect(() => {
    setVisibleCompletedNotes(completedNotes);
  }, [completedNotes]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    setPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (!isDrawerOpen || typeof window === "undefined") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const nextFocusableField = formRef.current?.querySelector("input:not([type='hidden']), textarea, select");
      if (
        nextFocusableField instanceof HTMLInputElement ||
        nextFocusableField instanceof HTMLTextAreaElement ||
        nextFocusableField instanceof HTMLSelectElement
      ) {
        nextFocusableField.focus();
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isDrawerOpen]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.classList.toggle("purchase-note-drawer-open", isDrawerOpen);
    return () => {
      document.body.classList.remove("purchase-note-drawer-open");
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, isSubmitting]);

  function resetFormFields() {
    setCustomerQuery("");
    setSelectedCustomerId(null);
    setContent("");
    setMaterialCategoryCounts(createEmptyOrderMaterialCategoryCounts());
    setUrgency(DEFAULT_URGENCY);
  }

  function markNoteBusy(noteId: string) {
    setBusyNoteIds((current) => (current.includes(noteId) ? current : [...current, noteId]));
  }

  function clearNoteBusy(noteId: string) {
    setBusyNoteIds((current) => current.filter((entry) => entry !== noteId));
  }

  function markNoteSliding(noteId: string) {
    setSlidingNoteIds((current) => (current.includes(noteId) ? current : [...current, noteId]));
  }

  function clearNoteSliding(noteId: string) {
    setSlidingNoteIds((current) => current.filter((entry) => entry !== noteId));
  }

  function triggerRefresh() {
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  function closeDrawer() {
    if (isSubmitting) {
      return;
    }

    setIsDrawerOpen(false);
    setEditingNoteId(null);
  }

  function openCreateDrawer() {
    resetFormFields();
    setDrawerMode("create");
    setEditingNoteId(null);
    setIsDrawerOpen(true);
    setFeedback(null);
  }

  function openEditDrawer(note: PurchaseNoteView) {
    const parsedMaterialNote = parseOrderMaterialNoteContent(note.content);
    setDrawerMode("edit");
    setEditingNoteId(note.id);
    setCustomerQuery(note.customerName);
    setSelectedCustomerId(note.customerId);
    setContent(parsedMaterialNote.content);
    setMaterialCategoryCounts(parsedMaterialNote.categoryCounts);
    setUrgency(note.urgency);
    setIsDrawerOpen(true);
    setFeedback(null);
  }

  async function handleSubmit(formData: FormData) {
    if (drawerMode === "edit" && !editingNoteId) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      formData.set(
        "content",
        buildOrderMaterialNoteContent({
          content,
          categoryEntries: materialCategoryEntries
        })
      );
      const note = drawerMode === "edit" ? await updateAction(formData) : await createAction(formData);

      if (drawerMode === "edit") {
        setVisiblePendingNotes((current) =>
          sortPendingPurchaseNotes(current.map((entry) => (entry.id === note.id ? note : entry)))
        );
        setVisibleCompletedNotes((current) =>
          sortCompletedPurchaseNotes(current.map((entry) => (entry.id === note.id ? note : entry)))
        );
      } else {
        setVisiblePendingNotes((current) => sortPendingPurchaseNotes([note, ...current]));
        setActiveTab("pending");
      }

      resetFormFields();
      setIsDrawerOpen(false);
      setEditingNoteId(null);
      setFeedback({
        tone: "success",
        message: drawerMode === "edit" ? "Nota aggiornata." : "Nota aggiunta alla lista da ordinare."
      });
      triggerRefresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(error, drawerMode === "edit" ? "Impossibile aggiornare la nota." : "Impossibile salvare la nota.")
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleComplete(noteId: string) {
    markNoteBusy(noteId);
    markNoteSliding(noteId);
    setFeedback(null);

    try {
      await sleep(EXIT_ANIMATION_MS);

      const formData = new FormData();
      formData.set("noteId", noteId);
      const updatedNote = await completeAction(formData);

      setVisiblePendingNotes((current) => current.filter((entry) => entry.id !== noteId));
      setVisibleCompletedNotes((current) => sortCompletedPurchaseNotes([updatedNote, ...current]));
      setFeedback({
        tone: "success",
        message: "Nota spostata tra gli ordini fatti."
      });
      triggerRefresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(error, "Impossibile segnare la nota come fatta.")
      });
    } finally {
      clearNoteBusy(noteId);
      clearNoteSliding(noteId);
    }
  }

  async function handleReopen(noteId: string) {
    markNoteBusy(noteId);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.set("noteId", noteId);
      const updatedNote = await reopenAction(formData);

      setVisibleCompletedNotes((current) => current.filter((entry) => entry.id !== noteId));
      setVisiblePendingNotes((current) => sortPendingPurchaseNotes([updatedNote, ...current]));
      setActiveTab("pending");
      setFeedback({
        tone: "success",
        message: "Nota riportata tra quelle da fare."
      });
      triggerRefresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(error, "Impossibile ripristinare la nota.")
      });
    } finally {
      clearNoteBusy(noteId);
    }
  }

  async function handleDelete(noteId: string) {
    const note = [...visiblePendingNotes, ...visibleCompletedNotes].find((entry) => entry.id === noteId);
    if (!note || typeof window === "undefined") {
      return;
    }

    const confirmed = window.confirm(`Eliminare la nota per ${note.customerName}?`);
    if (!confirmed) {
      return;
    }

    markNoteBusy(noteId);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.set("noteId", noteId);
      await deleteAction(formData);

      setVisiblePendingNotes((current) => current.filter((entry) => entry.id !== noteId));
      setVisibleCompletedNotes((current) => current.filter((entry) => entry.id !== noteId));
      if (editingNoteId === noteId) {
        setIsDrawerOpen(false);
        setEditingNoteId(null);
      }
      setFeedback({
        tone: "success",
        message: "Nota eliminata."
      });
      triggerRefresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(error, "Impossibile eliminare la nota.")
      });
    } finally {
      clearNoteBusy(noteId);
    }
  }

  const drawer =
    portalTarget && isDrawerOpen
      ? createPortal(
          <div className="purchase-note-drawer-layer open" aria-hidden={!isDrawerOpen}>
            <button
              aria-label="Chiudi pannello nota ordine"
              className="purchase-note-drawer-overlay"
              onClick={closeDrawer}
              tabIndex={isDrawerOpen ? 0 : -1}
              type="button"
            />

            <aside aria-modal="true" className="purchase-note-drawer" role="dialog">
              <div className="purchase-note-drawer-head">
                <div>
                  <strong>{drawerTitle}</strong>
                </div>
                <button
                  aria-label="Chiudi pannello"
                  className="purchase-note-drawer-close"
                  onClick={closeDrawer}
                  type="button"
                >
                  <span />
                  <span />
                </button>
              </div>

              <form action={handleSubmit} className="form-grid purchase-note-form" ref={formRef}>
                <input name="customerId" type="hidden" value={selectedCustomerId || ""} />
                <input name="customerName" type="hidden" value={customerQuery} />
                <input name="orderId" type="hidden" value={editingNote?.order?.id || ""} />
                {drawerMode === "edit" ? <input name="noteId" type="hidden" value={editingNoteId || ""} /> : null}

                <CustomerAutocomplete
                  customers={customers}
                  disabled={isDrawerLinkedToOrder}
                  label="Cliente"
                  onQueryChange={(value) => {
                    setCustomerQuery(value);
                    if (selectedCustomer && value.trim() !== selectedCustomer.name) {
                      setSelectedCustomerId(null);
                    }
                  }}
                  onSelect={(customer) => {
                    setSelectedCustomerId(customer.id);
                    setCustomerQuery(customer.name);
                  }}
                  placeholder="Cliente o ragione sociale"
                  query={customerQuery}
                  selectedCustomerId={selectedCustomerId}
                />

                {editingNote?.order ? (
                  <Link className="mini-item purchase-note-drawer-order-link" href={`/orders/${editingNote.order.id}`} prefetch={false}>
                    <strong>{editingNote.order.orderCode}</strong>
                    <span>{editingNote.order.title}</span>
                  </Link>
                ) : null}

                <div className="field full">
                  <label htmlFor="purchase-note-urgency">Urgenza</label>
                  <select
                    id="purchase-note-urgency"
                    name="urgency"
                    onChange={(event) => setUrgency(event.target.value as PurchaseNoteUrgency)}
                    value={urgency}
                  >
                    {Object.entries(purchaseNoteUrgencyLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <MaterialCategorySelectorField
                  idPrefix="purchase-note-material"
                  inputNamePrefix="materialCategoryCount"
                  onChange={setMaterialCategoryCounts}
                  value={materialCategoryCounts}
                />

                <div className="field full">
                  <label htmlFor="purchase-note-content">Note</label>
                  <textarea
                    id="purchase-note-content"
                    name="content"
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Dettagli liberi, colori, fornitore, urgenze..."
                    rows={6}
                    value={content}
                  />
                </div>

                <div className="button-row purchase-note-form-actions">
                  <button className="ghost" onClick={closeDrawer} type="button">
                    Annulla
                  </button>
                  <button className="primary" disabled={!canSubmit || isSubmitting} type="submit">
                    {isSubmitting ? "Salvo..." : drawerSubmitLabel}
                  </button>
                </div>
              </form>
            </aside>
          </div>,
          portalTarget
        )
      : null;

  return (
    <div className="stack purchase-notes-page-shell">
      <PageHeader
        action={
          <button
            className={`purchase-notes-header-action ${isDrawerOpen && drawerMode === "create" ? "secondary" : "primary"}`}
            onClick={() => {
              setActiveTab("pending");
              if (isDrawerOpen && drawerMode === "create") {
                closeDrawer();
                return;
              }

              openCreateDrawer();
            }}
            type="button"
          >
            <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <span>{isDrawerOpen && drawerMode === "create" ? "Chiudi nota" : "Nuova nota"}</span>
          </button>
        }
        title="Da ordinare"
      />

      <section className="card card-pad purchase-notes-list-card">
        <div className="purchase-notes-toolbar">
          <div className="purchase-notes-toolbar-head">
            <div className="purchase-notes-tabs" role="tablist" aria-label="Liste ordini da fare">
              <button
                aria-selected={activeTab === "pending"}
                className={`purchase-notes-tab${activeTab === "pending" ? " active" : ""}`}
                onClick={() => setActiveTab("pending")}
                role="tab"
                type="button"
              >
                <span>Da fare</span>
                <strong>{pendingCount}</strong>
              </button>
              <button
                aria-selected={activeTab === "completed"}
                className={`purchase-notes-tab${activeTab === "completed" ? " active" : ""}`}
                onClick={() => setActiveTab("completed")}
                role="tab"
                type="button"
              >
                <span>Fatti</span>
                <strong>{completedCount}</strong>
              </button>
            </div>

            {isRefreshing || activeCategoryFilter ? (
              <div className="purchase-notes-toolbar-meta">
                {activeCategoryFilter ? (
                  <span className="subtle">
                    {`${activeListCount} di ${activeListTotalCount} ${activeListTotalCount === 1 ? "nota" : "note"}`}
                  </span>
                ) : null}
                {isRefreshing ? <span className="subtle">Aggiorno lista...</span> : null}
              </div>
            ) : null}
          </div>

          <div className="purchase-notes-toolbar-filters">
            <div className="field purchase-notes-filter-field">
              <label htmlFor="purchase-notes-category-filter">Filtro categoria</label>
              <select
                id="purchase-notes-category-filter"
                onChange={(event) => setActiveCategoryFilter(event.target.value as OrderMaterialCategoryKey | "")}
                value={activeCategoryFilter}
              >
                <option value="">Tutte le categorie</option>
                {orderMaterialCategoryOptions.map(({ key, label }) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {activeCategoryFilter ? (
              <button className="button ghost purchase-notes-filter-clear" onClick={() => setActiveCategoryFilter("")} type="button">
                Azzera filtro
              </button>
            ) : null}
          </div>
        </div>

        {feedback ? (
          <div className={`purchase-notes-feedback ${feedback.tone === "success" ? "is-success" : "is-error"}`}>
            {feedback.message}
          </div>
        ) : null}

        {activeTab === "pending" ? (
          filteredPendingNotes.length > 0 ? (
            <div className="purchase-notes-list" role="tabpanel">
              {filteredPendingNotes.map((note) => {
                const isBusy = busyNoteIds.includes(note.id);
                const isSliding = slidingNoteIds.includes(note.id);

                return (
                  <article
                    className={`purchase-note-item${isBusy ? " is-busy" : ""}${isSliding ? " is-sliding-out" : ""}`}
                    key={note.id}
                  >
                    <div className="purchase-note-item-main">
                      <div className="purchase-note-item-head">
                        <div className="purchase-note-item-title">
                        {note.customerId ? (
                          <Link className="purchase-note-customer-link" href={`/customers/${note.customerId}`} prefetch={false}>
                            {note.customerName}
                          </Link>
                        ) : (
                          <strong>{note.customerName}</strong>
                        )}
                        <span>{`Inserito il ${formatDateTime(note.createdAt)}`}</span>
                        {note.order ? (
                          <Link className="purchase-note-order-link" href={`/orders/${note.order.id}`} prefetch={false}>
                            {buildOrderLinkLabel(note)}
                          </Link>
                        ) : null}
                      </div>
                      <div className="purchase-note-pill-row">
                        <span className={`pill ${getUrgencyToneClass(note.urgency)}`}>{purchaseNoteUrgencyLabels[note.urgency]}</span>
                        <span className="pill">{note.order ? "Ordine collegato" : note.customerId ? "Cliente rubrica" : "Cliente libero"}</span>
                        {note.order ? <span className="pill status">{operationalStatusLabels[note.order.operationalStatus]}</span> : null}
                      </div>
                    </div>
                    <p className="purchase-note-item-content">{note.content}</p>
                    </div>

                    <div className="purchase-note-item-side">
                      <div className="purchase-note-side-actions">
                        <button className="button ghost purchase-note-secondary-action" disabled={isBusy} onClick={() => openEditDrawer(note)} type="button">
                          Modifica
                        </button>
                        <button
                          className="button ghost purchase-note-secondary-action danger"
                          disabled={isBusy}
                          onClick={() => {
                            void handleDelete(note.id);
                          }}
                          type="button"
                        >
                          Elimina
                        </button>
                      </div>

                      <button
                        aria-label="Sposta tra gli ordini fatti"
                        className="button ghost purchase-note-status-button"
                        disabled={isBusy}
                        onClick={() => {
                          void handleComplete(note.id);
                        }}
                        title="Sposta tra gli ordini fatti"
                        type="button"
                      >
                        <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                          <path d="M4 12h10" />
                          <path d="m10 6 6 6-6 6" />
                          <path d="m15.5 8.5 2 2 3-3" />
                        </svg>
                      </button>
                      <span className="purchase-note-item-side-label">{isBusy ? "Invio..." : "Segna fatto"}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mini-item purchase-notes-empty-state" role="tabpanel">
              <strong>{activeCategoryFilter ? "Nessuna nota per questa categoria." : "Nessuna nota aperta."}</strong>
              {activeCategoryFilter ? (
                <button className="secondary" onClick={() => setActiveCategoryFilter("")} type="button">
                  Azzera filtro
                </button>
              ) : (
                <button className="secondary" onClick={openCreateDrawer} type="button">
                  Nuova nota
                </button>
              )}
            </div>
          )
        ) : filteredCompletedNotes.length > 0 ? (
          <div className="purchase-notes-list" role="tabpanel">
            {filteredCompletedNotes.map((note) => {
              const isBusy = busyNoteIds.includes(note.id);

              return (
                <article className={`purchase-note-item${isBusy ? " is-busy" : ""}`} key={note.id}>
                  <div className="purchase-note-item-main">
                    <div className="purchase-note-item-head">
                      <div className="purchase-note-item-title">
                        {note.customerId ? (
                          <Link className="purchase-note-customer-link" href={`/customers/${note.customerId}`} prefetch={false}>
                            {note.customerName}
                          </Link>
                        ) : (
                          <strong>{note.customerName}</strong>
                        )}
                        <span>{`Ordinato il ${formatDateTime(note.completedAt || note.updatedAt)}`}</span>
                        {note.order ? (
                          <Link className="purchase-note-order-link" href={`/orders/${note.order.id}`} prefetch={false}>
                            {buildOrderLinkLabel(note)}
                          </Link>
                        ) : null}
                      </div>
                      <div className="purchase-note-pill-row">
                        <span className={`pill ${getUrgencyToneClass(note.urgency)}`}>{purchaseNoteUrgencyLabels[note.urgency]}</span>
                        <span className="pill status">Archivio</span>
                        {note.order ? <span className="pill">{operationalStatusLabels[note.order.operationalStatus]}</span> : null}
                      </div>
                    </div>
                    <p className="purchase-note-item-content">{note.content}</p>
                  </div>

                  <div className="purchase-note-item-side">
                    <div className="purchase-note-side-actions">
                      <button className="button ghost purchase-note-secondary-action" disabled={isBusy} onClick={() => openEditDrawer(note)} type="button">
                        Modifica
                      </button>
                      <button
                        className="button ghost purchase-note-secondary-action danger"
                        disabled={isBusy}
                        onClick={() => {
                          void handleDelete(note.id);
                        }}
                        type="button"
                      >
                        Elimina
                      </button>
                    </div>

                    <button
                      aria-label="Riporta tra gli ordini da fare"
                      className="button ghost purchase-note-status-button done"
                      disabled={isBusy}
                      onClick={() => {
                        void handleReopen(note.id);
                      }}
                      title="Riporta tra gli ordini da fare"
                      type="button"
                    >
                      <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                        <path d="M20 12H10" />
                        <path d="m14 6-6 6 6 6" />
                      </svg>
                    </button>
                    <span className="purchase-note-item-side-label">{isBusy ? "Aggiorno..." : "Ripristina"}</span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mini-item purchase-notes-empty-state" role="tabpanel">
            <strong>{activeCategoryFilter ? "Nessun ordine fatto per questa categoria." : "Nessun archivio disponibile."}</strong>
            {activeCategoryFilter ? (
              <button className="secondary" onClick={() => setActiveCategoryFilter("")} type="button">
                Azzera filtro
              </button>
            ) : null}
          </div>
        )}
      </section>
      {drawer}
    </div>
  );
}
