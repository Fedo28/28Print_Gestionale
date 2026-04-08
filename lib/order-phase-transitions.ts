import { MainPhase } from "@prisma/client";
import { phaseOrder } from "@/lib/constants";

export function canTransitionPhase(currentPhase: MainPhase, nextPhase: MainPhase) {
  const currentIndex = phaseOrder.indexOf(currentPhase);
  const nextIndex = phaseOrder.indexOf(nextPhase);

  if (currentIndex === -1 || nextIndex === -1) {
    return false;
  }

  const delta = nextIndex - currentIndex;
  if (delta === 0) {
    return true;
  }

  if (nextPhase === "SVILUPPO_COMPLETATO" && currentIndex < nextIndex) {
    return true;
  }

  return Math.abs(delta) <= 1;
}

export function getSelectablePhaseTargets(currentPhase: MainPhase) {
  return phaseOrder.filter((phase) => canTransitionPhase(currentPhase, phase));
}
