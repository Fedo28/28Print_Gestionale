"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startVisiblePolling } from "@/lib/visible-polling";

export function WorkspaceLiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    return startVisiblePolling(() => router.refresh(), { intervalMs: 60_000, immediate: false });
  }, [router]);
  return null;
}
