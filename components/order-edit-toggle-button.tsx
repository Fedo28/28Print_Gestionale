"use client";

import { useEffect, useState } from "react";

export function OrderEditToggleButton({
  targetId,
  className = "button secondary order-detail-edit-toggle-button",
  label = "Modifica",
  openLabel = "Chiudi modifica",
  showIcon = false
}: {
  targetId: string;
  className?: string;
  label?: string;
  openLabel?: string;
  showIcon?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);

    if (!(target instanceof HTMLDetailsElement)) {
      return;
    }

    const sync = () => setIsOpen(target.open);
    sync();
    target.addEventListener("toggle", sync);
    return () => target.removeEventListener("toggle", sync);
  }, [targetId]);

  const handleClick = () => {
    const target = document.getElementById(targetId);

    if (!(target instanceof HTMLDetailsElement)) {
      return;
    }

    const nextOpen = !target.open;
    target.open = nextOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <button
      aria-controls={targetId}
      aria-expanded={isOpen}
      aria-label={isOpen ? "Chiudi modifica ordine" : "Apri modifica ordine"}
      className={className}
      onClick={handleClick}
      title={isOpen ? "Chiudi modifica" : "Modifica ordine"}
      type="button"
    >
      {showIcon ? (
        <svg aria-hidden="true" className="glyph" viewBox="0 0 24 24">
          <path
            d="m5 16 9.7-9.7a2.1 2.1 0 0 1 3 3L8 19H5v-3Z"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.9"
          />
        </svg>
      ) : null}
      <span>{isOpen ? openLabel : label}</span>
    </button>
  );
}
