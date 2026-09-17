"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

function normalizeWheelDelta(event: WheelEvent, fallbackPageSize: number) {
  const rawDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;

  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return rawDelta * 40;
  }

  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return rawDelta * fallbackPageSize;
  }

  return rawDelta;
}

export function ShopWheelCarousel({
  ariaLabel,
  children,
  className
}: {
  ariaLabel: string;
  children: ReactNode;
  className: string;
}) {
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const carouselElement = carouselRef.current;
    if (!carouselElement) {
      return undefined;
    }
    const carousel = carouselElement;

    function handleWheel(event: WheelEvent) {
      const maxLeft = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
      if (!maxLeft) {
        return;
      }

      const delta = normalizeWheelDelta(event, carousel.clientWidth);
      if (!delta) {
        return;
      }

      const nextLeft = Math.max(0, Math.min(maxLeft, carousel.scrollLeft + delta));
      if (nextLeft === carousel.scrollLeft) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      carousel.scrollLeft = nextLeft;
    }

    carousel.addEventListener("wheel", handleWheel, { passive: false });
    return () => carousel.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div className={className} aria-label={ariaLabel} ref={carouselRef}>
      {children}
    </div>
  );
}
