"use client";

import { useRef } from "react";

export function OrderItemDeleteButton({
  orderId,
  itemId,
  action,
  className = "ghost order-line-remove-icon",
  confirmMessage = "Eliminare questa riga ordine?",
  label = "x"
}: {
  orderId: string;
  itemId: string;
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  confirmMessage?: string;
  label?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={action} ref={formRef}>
      <input name="orderId" type="hidden" value={orderId} />
      <input name="itemId" type="hidden" value={itemId} />
      <button
        aria-label="Elimina riga"
        className={className}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (confirmMessage && !window.confirm(confirmMessage)) {
            return;
          }
          formRef.current?.requestSubmit();
        }}
        title="Elimina riga"
        type="submit"
      >
        {label}
      </button>
    </form>
  );
}
