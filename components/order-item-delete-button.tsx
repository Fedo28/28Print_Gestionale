"use client";

import { useRef } from "react";

export function OrderItemDeleteButton({
  orderId,
  itemId,
  action
}: {
  orderId: string;
  itemId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={action} ref={formRef}>
      <input name="orderId" type="hidden" value={orderId} />
      <input name="itemId" type="hidden" value={itemId} />
      <button
        aria-label="Elimina riga"
        className="ghost order-line-remove-icon"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          formRef.current?.requestSubmit();
        }}
        title="Elimina riga"
        type="submit"
      >
        x
      </button>
    </form>
  );
}
