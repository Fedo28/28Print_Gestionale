"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export function ConfirmSubmitButton({
  confirmMessage,
  children,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  confirmMessage: string;
  children: ReactNode;
}) {
  return (
    <button
      {...props}
      onClick={(event) => {
        if (props.disabled) {
          return;
        }

        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }

        onClick?.(event);
      }}
      type={props.type || "submit"}
    >
      {children}
    </button>
  );
}
