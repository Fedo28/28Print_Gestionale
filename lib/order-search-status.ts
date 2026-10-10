import type { MainPhase } from "@prisma/client";
import { mainPhaseLabels, normalizeMainPhaseForWorkflow } from "@/lib/constants";

export type OrderSearchStatus = {
  label: string;
  tone: "pending" | "working" | "ready" | "delivered";
};

export function getOrderSearchStatus(phase: MainPhase): OrderSearchStatus {
  const normalized = normalizeMainPhaseForWorkflow(phase);
  const tones = { ACCETTATO: "pending", IN_LAVORAZIONE: "working", SVILUPPO_COMPLETATO: "ready", CONSEGNATO: "delivered" } as const;
  return { label: mainPhaseLabels[normalized], tone: tones[normalized] };
}
