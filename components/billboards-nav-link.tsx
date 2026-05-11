"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PropsWithChildren, useState, useTransition } from "react";

type BillboardsNavLinkProps = PropsWithChildren<{
  href: string;
  className?: string;
}>;

export function BillboardsNavLink({ href, className, children }: BillboardsNavLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isBusy, setIsBusy] = useState(false);

  return (
    <Link
      className={`${className || ""} billboards-nav-link`}
      data-pending={isPending || isBusy ? "true" : undefined}
      href={href}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }

        event.preventDefault();
        setIsBusy(true);
        startTransition(() => {
          router.push(href);
        });
      }}
      onFocus={() => router.prefetch(href)}
      onMouseEnter={() => router.prefetch(href)}
      prefetch={false}
    >
      {children}
    </Link>
  );
}
