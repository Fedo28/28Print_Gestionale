"use client";

import { useEffect, useRef } from "react";
import { restoreOrderHistoryAction } from "@/app/actions";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function OrderHistoryUndoShortcut({
  orderId,
  historyId,
  returnTo,
  className = "button ghost",
  label = "Annulla ultima"
}: {
  orderId: string;
  historyId?: string | null;
  returnTo: string;
  className?: string;
  label?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!historyId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.shiftKey || event.key.toLowerCase() !== "z") {
        return;
      }

      if (!event.metaKey && !event.ctrlKey) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      event.preventDefault();
      buttonRef.current?.click();
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [historyId]);

  if (!historyId) {
    return null;
  }

  return (
    <form action={restoreOrderHistoryAction} className="order-history-undo-shortcut">
      <input name="orderId" type="hidden" value={orderId} />
      <input name="historyId" type="hidden" value={historyId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <button
        className={className}
        onClick={(event) => {
          if (!window.confirm("Ripristinare l'ultima azione salvata?")) {
            event.preventDefault();
          }
        }}
        ref={buttonRef}
        title={`${label} (Cmd+Z)`}
        type="submit"
      >
        {label}
      </button>
    </form>
  );
}
