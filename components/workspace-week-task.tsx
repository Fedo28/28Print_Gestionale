"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function WorkspaceWeekTask({ taskId, title, status, details, actions, open, onOpen, onClose }: {
  taskId: string; title: string; status: string; details: ReactNode; actions: ReactNode;
  open: boolean; onOpen: () => void; onClose: () => void;
}) {
  const [position, setPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const skipFocus = useRef(false);
  const popoverId = `week-task-details-${taskId}`;

  function clearCloseTimer() { clearTimeout(closeTimer.current); }
  function showDetails() { clearCloseTimer(); onOpen(); }
  function closeDetails(restoreFocus = false) {
    clearCloseTimer(); onClose(); setPosition(null);
    if (restoreFocus) {
      skipFocus.current = true;
      titleRef.current?.focus({ preventScroll: true });
      skipFocus.current = false;
    }
  }
  function scheduleClose() {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      const focused = document.activeElement;
      if (!cardRef.current?.contains(focused) && !popoverRef.current?.contains(focused)) closeDetails();
    }, 180);
  }

  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useLayoutEffect(() => {
    if (!open) { setPosition(null); return; }
    function placeDetails() {
      const anchor = cardRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 24);
      const maxHeight = Math.min(420, window.innerHeight - 24);
      const height = Math.min(popover.scrollHeight, maxHeight);
      let left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      let top = Math.max(12, Math.min(rect.top, window.innerHeight - height - 12));
      if (rect.right + width + 22 <= window.innerWidth) left = rect.right + 10;
      else if (rect.left - width - 10 >= 12) left = rect.left - width - 10;
      else {
        const below = rect.bottom + 8;
        top = below + height <= window.innerHeight - 12 ? below : Math.max(12, rect.top - height - 8);
      }
      setPosition({ left, top, width, maxHeight });
    }
    placeDetails();
    window.addEventListener("resize", placeDetails);
    document.addEventListener("scroll", placeDetails, true);
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetails(Boolean(cardRef.current?.contains(document.activeElement) || popoverRef.current?.contains(document.activeElement)));
      }
    }
    function handleOutside(event: PointerEvent) {
      if (event.target instanceof Node && !cardRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) closeDetails();
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("pointerdown", handleOutside);
    return () => {
      window.removeEventListener("resize", placeDetails);
      document.removeEventListener("scroll", placeDetails, true);
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("pointerdown", handleOutside);
    };
  }, [open]);

  return <>
    <article ref={cardRef} className={`workspace-task-card is-weekly status-${status.toLowerCase()}`}
      onMouseLeave={scheduleClose} onBlur={scheduleClose}
      onClickCapture={(event) => { if (event.target instanceof Element && event.target.closest(".workspace-task-actions button")) closeDetails(); }}>
      <h3><button ref={titleRef} type="button" className="workspace-week-task-title" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popoverId : undefined}
        onFocus={(event) => { if (!skipFocus.current && event.currentTarget.matches(":focus-visible")) showDetails(); }}
        onMouseEnter={showDetails} onClick={showDetails}>{title}</button></h3>
      {actions}
    </article>
    {open ? createPortal(<div ref={popoverRef} id={popoverId} className="workspace-week-task-popover" role="dialog" aria-modal="false" aria-labelledby={`${popoverId}-title`}
      style={{ ...position, visibility: position ? "visible" : "hidden" }} onMouseEnter={clearCloseTimer} onMouseLeave={scheduleClose} onBlur={scheduleClose}>
      <header><h3 id={`${popoverId}-title`}>{title}</h3><button type="button" className="workspace-week-task-close" aria-label="Chiudi dettagli incarico" onClick={() => closeDetails(true)}>×</button></header>
      <div className="workspace-week-task-info">{details}</div>
    </div>, document.body) : null}
  </>;
}
