"use client";

import { useEffect, useRef } from "react";
import { UndoButtonContent } from "@/components/undo-button-content";
import { useUndoHistory } from "@/components/use-undo-history";

type FormFieldSnapshot =
  | { kind: "value"; value: string }
  | { kind: "checked"; checked: boolean }
  | { kind: "multi"; value: string[] };

type FormSnapshot = FormFieldSnapshot[];

function isNamedControl(
  element: Element
): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement) &&
    !(element instanceof HTMLSelectElement)
  ) {
    return false;
  }

  return Boolean(element.name);
}

function readFormSnapshot(form: HTMLFormElement): FormSnapshot {
  return Array.from(form.elements)
    .filter((element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
      element instanceof Element ? isNamedControl(element) : false
    )
    .map((element) => {
      if (element instanceof HTMLSelectElement && element.multiple) {
        return {
          kind: "multi" as const,
          value: Array.from(element.selectedOptions).map((option) => option.value)
        };
      }

      if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        return {
          kind: "checked" as const,
          checked: element.checked
        };
      }

      return {
        kind: "value" as const,
        value: element.value
      };
    });
}

function applyFormSnapshot(form: HTMLFormElement, snapshot: FormSnapshot) {
  const controls = Array.from(form.elements).filter((element): element is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
    element instanceof Element ? isNamedControl(element) : false
  );

  snapshot.forEach((field, index) => {
    const element = controls[index];
    if (!element) {
      return;
    }

    if (field.kind === "multi" && element instanceof HTMLSelectElement && element.multiple) {
      const selected = new Set(field.value);
      Array.from(element.options).forEach((option) => {
        option.selected = selected.has(option.value);
      });
      return;
    }

    if (field.kind === "checked" && element instanceof HTMLInputElement) {
      element.checked = field.checked;
      return;
    }

    if (field.kind === "value") {
      element.value = field.value;
    }
  });

  form.dispatchEvent(new Event("input", { bubbles: true }));
  form.dispatchEvent(new Event("change", { bubbles: true }));
}

export function FormUndoButton({
  className = "ghost",
  label = "Indietro"
}: {
  className?: string;
  label?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const seededRef = useRef(false);
  const restoringRef = useRef(false);
  const undoHistory = useUndoHistory<FormSnapshot>({
    limit: 40,
    debounceMs: 180
  });
  const { canUndo, undo, undoCount, record, reset } = undoHistory;

  useEffect(() => {
    const button = buttonRef.current;
    const form = button?.closest("form");
    if (!form) {
      return;
    }

    const seed = () => {
      reset(readFormSnapshot(form));
      seededRef.current = true;
    };

    const handleMutation = () => {
      if (restoringRef.current) {
        return;
      }

      const snapshot = readFormSnapshot(form);
      if (!seededRef.current) {
        reset(snapshot);
        seededRef.current = true;
        return;
      }

      record(snapshot);
    };

    seed();
    form.addEventListener("input", handleMutation, true);
    form.addEventListener("change", handleMutation, true);
    form.addEventListener("reset", seed, true);

    return () => {
      form.removeEventListener("input", handleMutation, true);
      form.removeEventListener("change", handleMutation, true);
      form.removeEventListener("reset", seed, true);
    };
  }, [record, reset]);

  return (
    <button
      className={`${className} undo-action-button`.trim()}
      disabled={!canUndo}
      onClick={(event) => {
        event.preventDefault();
        if (!canUndo) {
          return;
        }

        if (!window.confirm("Vuoi annullare l'ultima modifica di questo modulo?")) {
          return;
        }

        const button = buttonRef.current;
        const form = button?.closest("form");
        const snapshot = undo();

        if (!form || !snapshot) {
          return;
        }

        restoringRef.current = true;
        applyFormSnapshot(form, snapshot);
        window.requestAnimationFrame(() => {
          restoringRef.current = false;
        });
      }}
      ref={buttonRef}
      title={canUndo ? `${label} (${undoCount})` : label}
      type="button"
    >
      <UndoButtonContent count={canUndo ? undoCount : undefined} label={label} />
    </button>
  );
}
