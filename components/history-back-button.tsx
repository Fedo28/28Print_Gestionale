"use client";

import { useRouter } from "next/navigation";

export function HistoryBackButton({
  fallbackHref,
  label,
  className,
  title
}: {
  fallbackHref: string;
  label: string;
  className?: string;
  title?: string;
}) {
  const router = useRouter();

  return (
    <button
      className={className}
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }

        router.push(fallbackHref);
      }}
      title={title || label}
      type="button"
    >
      {label}
    </button>
  );
}
