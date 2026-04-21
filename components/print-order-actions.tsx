"use client";

import Link from "next/link";

export function PrintOrderActions({ backHref }: { backHref: string }) {
  return (
    <>
      <button className="button primary" onClick={() => window.print()} type="button">
        Stampa adesso
      </button>
      <Link className="button ghost" href={backHref}>
        Torna all'ordine
      </Link>
    </>
  );
}
