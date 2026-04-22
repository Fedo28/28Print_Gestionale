"use client";

import { useEffect, useState } from "react";
import {
  buildOrderDraftStorageKey,
  buildOrderDraftSubmittedKey,
  hasMeaningfulOrderDraft,
  ORDER_DRAFT_STORAGE_EVENT,
  parseOrderDraftSnapshot,
  type OrderDraftMode
} from "@/lib/order-drafts";

function readHasDraft(kind: OrderDraftMode) {
  if (typeof window === "undefined") {
    return false;
  }

  const snapshot = parseOrderDraftSnapshot(window.localStorage.getItem(buildOrderDraftStorageKey(kind)));
  return Boolean(snapshot && snapshot.kind === kind && hasMeaningfulOrderDraft(snapshot));
}

export function OrderDraftHeaderAction({ kind }: { kind: OrderDraftMode }) {
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    const syncDraftState = () => {
      setHasDraft(readHasDraft(kind));
    };

    syncDraftState();
    window.addEventListener("storage", syncDraftState);
    window.addEventListener("focus", syncDraftState);
    window.addEventListener(ORDER_DRAFT_STORAGE_EVENT, syncDraftState as EventListener);

    return () => {
      window.removeEventListener("storage", syncDraftState);
      window.removeEventListener("focus", syncDraftState);
      window.removeEventListener(ORDER_DRAFT_STORAGE_EVENT, syncDraftState as EventListener);
    };
  }, [kind]);

  return (
    <button
      className="ghost"
      disabled={!hasDraft}
      onClick={() => {
        if (typeof window === "undefined") {
          return;
        }

        window.localStorage.removeItem(buildOrderDraftStorageKey(kind));
        window.sessionStorage.removeItem(buildOrderDraftSubmittedKey(kind));
        window.dispatchEvent(new Event(ORDER_DRAFT_STORAGE_EVENT));
        window.location.reload();
      }}
      type="button"
    >
      Svuota bozza
    </button>
  );
}
