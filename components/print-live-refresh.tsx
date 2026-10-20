"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { startVisiblePolling } from "@/lib/visible-polling";
export function PrintLiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    return startVisiblePolling(() => router.refresh(), { intervalMs: 15000, immediate: false });
  }, [router]);
  return null;
}
