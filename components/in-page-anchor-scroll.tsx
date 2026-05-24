"use client";

import { useEffect } from "react";

function decodeAnchorTarget(hash: string) {
  return decodeURIComponent(hash.replace(/^#/, "").trim());
}

function shouldAnimateScroll() {
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scheduleAnchorScroll(href: string) {
  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !url.hash) {
      return;
    }

    const targetId = decodeAnchorTarget(url.hash);
    if (!targetId) {
      return;
    }

    const delays = [40, 140, 300, 520, 820];

    for (const [index, delay] of delays.entries()) {
      window.setTimeout(() => {
        const target = document.getElementById(targetId);
        if (!target) {
          return;
        }

        target.scrollIntoView({
          behavior: index === 0 && shouldAnimateScroll() ? "smooth" : "auto",
          block: "start"
        });
      }, delay);
    }
  } catch {
    // Ignore malformed URLs so link behavior stays untouched.
  }
}

export function InPageAnchorScroll() {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      scheduleAnchorScroll(link.href);
    };

    const handleHashBasedNavigation = () => {
      scheduleAnchorScroll(window.location.href);
    };

    handleHashBasedNavigation();
    document.addEventListener("click", handleClick, true);
    window.addEventListener("hashchange", handleHashBasedNavigation);
    window.addEventListener("pageshow", handleHashBasedNavigation);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("hashchange", handleHashBasedNavigation);
      window.removeEventListener("pageshow", handleHashBasedNavigation);
    };
  }, []);

  return null;
}
