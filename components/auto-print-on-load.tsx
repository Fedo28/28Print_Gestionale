"use client";

import { useEffect } from "react";

export function AutoPrintOnLoad() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.print();
    }, 180);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
