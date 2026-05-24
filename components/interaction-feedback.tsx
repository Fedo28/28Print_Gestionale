"use client";

import { useEffect } from "react";

const INTERACTION_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  "[role='button']",
  "[role='menuitem']",
  ".purchase-notes-tab",
  ".billboards-summary-card-v3"
].join(", ");

function clearInteractionFlag(element: HTMLElement, attribute: string) {
  element.removeAttribute(attribute);
}

function findInteractionTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest(INTERACTION_SELECTOR) instanceof HTMLElement
    ? (target.closest(INTERACTION_SELECTOR) as HTMLElement)
    : null;
}

export function InteractionFeedback() {
  useEffect(() => {
    const activeTimers = new WeakMap<HTMLElement, number>();
    const pressTimers = new WeakMap<HTMLElement, number>();
    const pendingTimers = new WeakMap<HTMLElement, number>();

    const scheduleFlag = (element: HTMLElement, attribute: string, duration: number, store: WeakMap<HTMLElement, number>) => {
      const previous = store.get(element);
      if (previous) {
        window.clearTimeout(previous);
      }

      element.setAttribute(attribute, "true");
      const timeoutId = window.setTimeout(() => {
        clearInteractionFlag(element, attribute);
        store.delete(element);
      }, duration);

      store.set(element, timeoutId);
    };

    const markPress = (element: HTMLElement) => {
      scheduleFlag(element, "data-interaction-press", 180, pressTimers);
    };

    const markActive = (element: HTMLElement) => {
      scheduleFlag(element, "data-interaction-active", 760, activeTimers);
    };

    const markPending = (element: HTMLElement, duration = 12000) => {
      scheduleFlag(element, "data-interaction-pending", duration, pendingTimers);
    };

    const clearAllPending = () => {
      document.querySelectorAll<HTMLElement>("[data-interaction-pending='true']").forEach((element) => {
        clearInteractionFlag(element, "data-interaction-pending");
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const element = findInteractionTarget(event.target);
      if (!element) {
        return;
      }

      markPress(element);
    };

    const handleClick = (event: MouseEvent) => {
      const element = findInteractionTarget(event.target);
      if (!element) {
        return;
      }

      markActive(element);

      if (element instanceof HTMLAnchorElement && element.href) {
        markPending(element, 1400);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const element = findInteractionTarget(event.target);
      if (!element) {
        return;
      }

      markPress(element);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const element = findInteractionTarget(event.target);
      if (!element) {
        return;
      }

      markActive(element);
    };

    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      const submitter =
        event.submitter instanceof HTMLElement
          ? findInteractionTarget(event.submitter) || event.submitter
          : (form.querySelector("button[type='submit'], input[type='submit']") as HTMLElement | null);

      if (!submitter) {
        return;
      }

      markActive(submitter);
      markPending(submitter);
      form.setAttribute("data-interaction-pending", "true");
      window.setTimeout(() => {
        form.removeAttribute("data-interaction-pending");
      }, 12000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearAllPending();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("pageshow", clearAllPending);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("pageshow", clearAllPending);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
