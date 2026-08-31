"use client";

import type { DragEvent } from "react";
import type { MainPhase, OperationalStatus } from "@prisma/client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { moveOrderInProductionAction } from "@/app/actions";
import { QuickOrderControls } from "@/components/quick-order-controls";
import { ReadyWhatsAppButton } from "@/components/ready-whatsapp-button";
import { StatusPills } from "@/components/status-pills";
import { normalizeMainPhaseForWorkflow, operationalStatusLabels } from "@/lib/constants";
import { formatCompactDate } from "@/lib/format";
import { getDisplayOrderLabel } from "@/lib/order-display";
import type { getProductionQueues } from "@/lib/orders";
import { getWorkdayHighlight } from "@/lib/workday-highlights";

type ProductionOrder = Awaited<ReturnType<typeof getProductionQueues>>["planning"][number];
type QueueKey = "planning" | "working" | "blocked" | "ready";
type ProductionTarget = "PLANNING" | "WORKING" | "READY" | "BLOCKED";

const VISIBLE_ORDERS_PER_QUEUE = 6;

const queueDetails: Record<QueueKey, { title: string }> = {
  planning: { title: "Da avviare" },
  working: { title: "In lavorazione" },
  blocked: { title: "Sospesi" },
  ready: { title: "Pronti" }
};

const suspensionOptions: Array<{ status: OperationalStatus; label: string }> = [
  { status: "IN_ATTESA_FILE", label: "Mi manca un file" },
  { status: "IN_ATTESA_MATERIALE", label: "Mi manca materiale" },
  { status: "IN_ATTESA_APPROVAZIONE", label: "Aspetto il cliente" }
];

function getPhaseQueue(order: ProductionOrder): Exclude<QueueKey, "blocked"> {
  const phase = normalizeMainPhaseForWorkflow(order.mainPhase);

  if (phase === "SVILUPPO_COMPLETATO") {
    return "ready";
  }

  if (phase === "IN_LAVORAZIONE") {
    return "working";
  }

  return "planning";
}

function getCurrentQueue(order: ProductionOrder): QueueKey {
  return order.operationalStatus === "ATTIVO" ? getPhaseQueue(order) : "blocked";
}

function getTargetForQueue(queue: Exclude<QueueKey, "blocked">): ProductionTarget {
  if (queue === "planning") {
    return "PLANNING";
  }

  if (queue === "working") {
    return "WORKING";
  }

  return "READY";
}

function getAllowedDropQueues(order: ProductionOrder): QueueKey[] {
  const phaseQueue = getPhaseQueue(order);
  const nearbyQueues: Exclude<QueueKey, "blocked">[] =
    phaseQueue === "planning" ? ["planning", "working"] : phaseQueue === "working" ? ["planning", "working", "ready"] : ["working", "ready"];

  if (order.operationalStatus !== "ATTIVO") {
    return nearbyQueues;
  }

  return [...nearbyQueues.filter((queue) => queue !== phaseQueue), "blocked"];
}

function getNextAction(queue: QueueKey) {
  if (queue === "planning") {
    return { label: "Avvia", target: "WORKING" as const };
  }

  if (queue === "working") {
    return { label: "Pronto", target: "READY" as const };
  }

  return null;
}

function getUndoInput(order: ProductionOrder) {
  if (order.operationalStatus !== "ATTIVO") {
    return {
      target: "BLOCKED" as const,
      blockedStatus: order.operationalStatus,
      note: order.operationalNote || operationalStatusLabels[order.operationalStatus],
      restorePhase: order.mainPhase
    };
  }

  return { target: getTargetForQueue(getPhaseQueue(order)) };
}

function DragGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="8" cy="6" r="1.5" fill="currentColor" />
      <circle cx="16" cy="6" r="1.5" fill="currentColor" />
      <circle cx="8" cy="12" r="1.5" fill="currentColor" />
      <circle cx="16" cy="12" r="1.5" fill="currentColor" />
      <circle cx="8" cy="18" r="1.5" fill="currentColor" />
      <circle cx="16" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ProductionCard({
  order,
  queue,
  isMoving,
  onDragEnd,
  onDragStart,
  onMove,
  onSuspend
}: {
  order: ProductionOrder;
  queue: QueueKey;
  isMoving: boolean;
  onDragEnd: () => void;
  onDragStart: (event: DragEvent<HTMLElement>, orderId: string) => void;
  onMove: (order: ProductionOrder, target: ProductionTarget) => void;
  onSuspend: (order: ProductionOrder) => void;
}) {
  const workdayHighlight = getWorkdayHighlight(order.deliveryAt);
  const whatsappNotified = queue === "ready" && Boolean(order.readyWhatsappSentAt);
  const hasWhatsapp = Boolean((order.customer.whatsapp || order.customer.phone || "").replace(/[^\d+]/g, ""));
  const nextAction = getNextAction(queue);
  const urgent = order.priority === "URGENTE";
  const shopOnlineOrderCode = getProductionShopOnlineOrderCode(order);

  return (
    <article
      aria-busy={isMoving}
      className={`compact-order-item compact-order-item-dashboard compact-order-item-dense workday-highlight-card production-order-card${
        workdayHighlight ? ` ${workdayHighlight}` : ""
      }${shopOnlineOrderCode ? " is-shop-online" : ""}${whatsappNotified ? " whatsapp-notified" : ""}${urgent ? " production-order-card-urgent" : ""}${isMoving ? " is-moving" : ""}`}
      draggable={!isMoving}
      onDragEnd={onDragEnd}
      onDragStart={(event) => onDragStart(event, order.id)}
    >
      <div className="compact-order-main">
        <div className="compact-order-head">
          <span aria-hidden="true" className="production-drag-handle" title="Trascina ordine">
            <DragGlyph />
          </span>
          <QuickOrderControls
            align="start"
            hasWhatsapp={hasWhatsapp}
            orderId={order.id}
            phase={order.mainPhase}
            placement="above"
            readyWhatsappSentAt={order.readyWhatsappSentAt}
            showStatus={false}
            showWhatsapp={false}
            status={order.operationalStatus}
          />
          <Link className="order-code" href={`/orders/${order.id}`} draggable={false}>
            {order.customer.name}
          </Link>
        </div>

        <div className="subtle compact-order-customer">{getDisplayOrderLabel(order.orderCode, order.title)}</div>
        <div className="hint compact-order-meta">Consegna {formatCompactDate(order.deliveryAt)}</div>
        {shopOnlineOrderCode ? (
          <div className="shop-online-card-meta">
            <span className="pill shop-online-pill">Shop online</span>
            <span>{shopOnlineOrderCode}</span>
          </div>
        ) : null}
        {whatsappNotified ? <div className="hint order-whatsapp-status">Cliente avvisato</div> : null}
        {workdayHighlight === "weekend" ? <div className="hint">Consegna in weekend</div> : null}
        {queue === "blocked" ? <div className="hint production-blocked-note">{order.operationalNote || operationalStatusLabels[order.operationalStatus]}</div> : null}
      </div>

      <div className="production-card-actions">
        {queue === "ready" ? (
          <ReadyWhatsAppButton compact hasPhone={hasWhatsapp} notifiedAt={order.readyWhatsappSentAt} orderId={order.id} showLabel />
        ) : queue === "blocked" ? (
          <button className="button ghost production-card-action" disabled={isMoving} onClick={() => onMove(order, getTargetForQueue(getPhaseQueue(order)))} type="button">
            Riprendi
          </button>
        ) : (
          <>
            {nextAction ? (
              <button className="button ghost production-card-action" disabled={isMoving} onClick={() => onMove(order, nextAction.target)} type="button">
                {nextAction.label}
              </button>
            ) : null}
            <button className="button ghost production-card-action muted" disabled={isMoving} onClick={() => onSuspend(order)} type="button">
              Sospendi
            </button>
          </>
        )}
      </div>

      <StatusPills hideNeutralStatus linked={false} payment={order.paymentStatus} phase={order.mainPhase} status={order.operationalStatus} />
    </article>
  );
}

function getProductionShopOnlineOrderCode(order: ProductionOrder) {
  return order.salesOrderLinks?.find((link) => link.salesOrder.origin === "SHOP_ONLINE")?.salesOrder.orderCode || null;
}

function ProductionLane({
  canDrop,
  draggedOrderId,
  isDropActive,
  isMoving,
  onDragEnd,
  onDragOver,
  onDrop,
  onDragStart,
  onMove,
  onSuspend,
  orders,
  queue
}: {
  canDrop: boolean;
  draggedOrderId: string | null;
  isDropActive: boolean;
  isMoving: boolean;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>, queue: QueueKey) => void;
  onDrop: (event: DragEvent<HTMLElement>, queue: QueueKey) => void;
  onDragStart: (event: DragEvent<HTMLElement>, orderId: string) => void;
  onMove: (order: ProductionOrder, target: ProductionTarget) => void;
  onSuspend: (order: ProductionOrder) => void;
  orders: ProductionOrder[];
  queue: QueueKey;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleOrders = isExpanded ? orders : orders.slice(0, VISIBLE_ORDERS_PER_QUEUE);
  const details = queueDetails[queue];

  return (
    <section
      className={`card card-pad compact-lane-card queue-column-card production-lane${isDropActive ? " is-drop-active" : ""}${
        canDrop ? " can-drop" : ""
      }`}
      data-queue={queue}
      onDragOver={(event) => onDragOver(event, queue)}
      onDrop={(event) => onDrop(event, queue)}
    >
      <div className="list-header">
        <div>
          <h3>{details.title}</h3>
        </div>
        <span className="pill">{orders.length}</span>
      </div>

      <div className="compact-order-list">
        {orders.length === 0 ? (
          <div className="empty">{draggedOrderId && canDrop ? "Rilascia qui l'ordine" : "Nessun ordine in questa coda."}</div>
        ) : (
          <div className="compact-order-grid compact-order-grid-dense queue-grid-dense">
            {visibleOrders.map((order) => (
              <ProductionCard
                isMoving={isMoving}
                key={order.id}
                onDragEnd={onDragEnd}
                onDragStart={onDragStart}
                onMove={onMove}
                onSuspend={onSuspend}
                order={order}
                queue={queue}
              />
            ))}
          </div>
        )}
      </div>

      {orders.length > VISIBLE_ORDERS_PER_QUEUE ? (
        <button className="production-show-more" onClick={() => setIsExpanded((current) => !current)} type="button">
          {isExpanded ? "Mostra meno" : `Mostra tutti (${orders.length})`}
        </button>
      ) : null}
    </section>
  );
}

function SuspensionDialog({
  detail,
  onCancel,
  onConfirm,
  onDetailChange,
  onStatusChange,
  order,
  selectedStatus
}: {
  detail: string;
  onCancel: () => void;
  onConfirm: () => void;
  onDetailChange: (value: string) => void;
  onStatusChange: (status: OperationalStatus) => void;
  order: ProductionOrder;
  selectedStatus: OperationalStatus;
}) {
  return (
    <div aria-labelledby="production-suspension-title" aria-modal="true" className="production-suspension-backdrop" role="dialog">
      <section className="production-suspension-dialog">
        <div>
          <span className="compact-kicker">Sospendi ordine</span>
          <h3 id="production-suspension-title">{order.customer.name}</h3>
          <p className="hint">{getDisplayOrderLabel(order.orderCode, order.title)}</p>
        </div>

        <div className="production-suspension-options">
          {suspensionOptions.map((option) => (
            <button
              className={`production-suspension-option${selectedStatus === option.status ? " active" : ""}`}
              key={option.status}
              onClick={() => onStatusChange(option.status)}
              type="button"
            >
              <strong>{option.label}</strong>
            </button>
          ))}
        </div>

        <label className="field production-suspension-detail">
          <span>Dettaglio</span>
          <input onChange={(event) => onDetailChange(event.target.value)} value={detail} />
        </label>

        <div className="button-row production-suspension-actions">
          <button className="button ghost" onClick={onCancel} type="button">
            Annulla
          </button>
          <button className="button danger" onClick={onConfirm} type="button">
            Sospendi ordine
          </button>
        </div>
      </section>
    </div>
  );
}

export function ProductionBoard({ queues }: { queues: Awaited<ReturnType<typeof getProductionQueues>> }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dropQueue, setDropQueue] = useState<QueueKey | null>(null);
  const [isMovingOrderId, setIsMovingOrderId] = useState<string | null>(null);
  const [suspensionOrder, setSuspensionOrder] = useState<ProductionOrder | null>(null);
  const [suspensionStatus, setSuspensionStatus] = useState<OperationalStatus>("IN_ATTESA_FILE");
  const [suspensionDetail, setSuspensionDetail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [undoOrder, setUndoOrder] = useState<ProductionOrder | null>(null);

  const readyOrders = [...queues.ready].sort((left, right) => {
    const notificationDifference = Number(Boolean(left.readyWhatsappSentAt)) - Number(Boolean(right.readyWhatsappSentAt));
    if (notificationDifference !== 0) {
      return notificationDifference;
    }

    return new Date(left.deliveryAt).getTime() - new Date(right.deliveryAt).getTime();
  });
  const boardQueues: Record<QueueKey, ProductionOrder[]> = {
    planning: queues.planning,
    working: queues.working,
    blocked: queues.blocked,
    ready: readyOrders
  };
  const allOrders = Object.values(boardQueues).flat();
  const draggedOrder = draggedOrderId ? allOrders.find((order) => order.id === draggedOrderId) || null : null;

  useEffect(() => {
    if (!undoOrder) {
      return;
    }

    const timer = window.setTimeout(() => setUndoOrder(null), 8000);
    return () => window.clearTimeout(timer);
  }, [undoOrder]);

  function moveOrder(
    order: ProductionOrder,
    target: ProductionTarget,
    options?: { blockedStatus?: OperationalStatus; note?: string; restorePhase?: MainPhase; recordUndo?: boolean }
  ) {
    setIsMovingOrderId(order.id);
    setNotice(null);

    startTransition(() => {
      void moveOrderInProductionAction({
        orderId: order.id,
        target,
        blockedStatus: options?.blockedStatus,
        note: options?.note,
        restorePhase: options?.restorePhase
      })
        .then((result) => {
          if (options?.recordUndo !== false) {
            setUndoOrder(order);
          } else {
            setNotice(result.message);
          }
          router.refresh();
        })
        .catch((error) => {
          setNotice(error instanceof Error ? error.message : "Non sono riuscito a spostare l'ordine.");
        })
        .finally(() => setIsMovingOrderId(null));
    });
  }

  function openSuspension(order: ProductionOrder) {
    setSuspensionOrder(order);
    setSuspensionStatus("IN_ATTESA_FILE");
    setSuspensionDetail("");
  }

  function confirmSuspension() {
    if (!suspensionOrder) {
      return;
    }

    const selectedOption = suspensionOptions.find((option) => option.status === suspensionStatus);
    const note = suspensionDetail.trim() || selectedOption?.label || "Ordine sospeso";
    moveOrder(suspensionOrder, "BLOCKED", { blockedStatus: suspensionStatus, note });
    setSuspensionOrder(null);
  }

  function handleDragStart(event: DragEvent<HTMLElement>, orderId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", orderId);
    setDraggedOrderId(orderId);
  }

  function handleDragEnd() {
    setDraggedOrderId(null);
    setDropQueue(null);
  }

  function handleDragOver(event: DragEvent<HTMLElement>, queue: QueueKey) {
    if (!draggedOrder || !getAllowedDropQueues(draggedOrder).includes(queue)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropQueue(queue);
  }

  function handleDrop(event: DragEvent<HTMLElement>, queue: QueueKey) {
    event.preventDefault();
    const orderId = event.dataTransfer.getData("text/plain") || draggedOrderId;
    const order = orderId ? allOrders.find((item) => item.id === orderId) : null;
    handleDragEnd();

    if (!order || !getAllowedDropQueues(order).includes(queue)) {
      setNotice("Sposta l’ordine di una fase alla volta.");
      return;
    }

    if (queue === "blocked") {
      openSuspension(order);
      return;
    }

    moveOrder(order, getTargetForQueue(queue));
  }

  function undoLastMove() {
    if (!undoOrder) {
      return;
    }

    const undoInput = getUndoInput(undoOrder);
    moveOrder(undoOrder, undoInput.target, { ...undoInput, recordUndo: false });
    setUndoOrder(null);
  }

  return (
    <>
      <div className="production-board" aria-label="Bacheca produzione">
        <div className="grid grid-2 production-board-grid">
          {(Object.keys(queueDetails) as QueueKey[]).map((queue) => (
            <ProductionLane
              canDrop={Boolean(draggedOrder && getAllowedDropQueues(draggedOrder).includes(queue))}
              draggedOrderId={draggedOrderId}
              isDropActive={dropQueue === queue}
              isMoving={isMovingOrderId !== null}
              key={queue}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onMove={moveOrder}
              onSuspend={openSuspension}
              orders={boardQueues[queue]}
              queue={queue}
            />
          ))}
        </div>
      </div>

      {notice ? <div aria-live="polite" className="production-board-notice">{notice}</div> : null}
      {undoOrder ? (
        <div aria-live="polite" className="production-undo-toast">
          <span>Ordine aggiornato.</span>
          <button onClick={undoLastMove} type="button">
            Annulla
          </button>
        </div>
      ) : null}
      {suspensionOrder ? (
        <SuspensionDialog
          detail={suspensionDetail}
          onCancel={() => setSuspensionOrder(null)}
          onConfirm={confirmSuspension}
          onDetailChange={setSuspensionDetail}
          onStatusChange={setSuspensionStatus}
          order={suspensionOrder}
          selectedStatus={suspensionStatus}
        />
      ) : null}
    </>
  );
}
