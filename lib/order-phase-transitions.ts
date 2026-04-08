import { MainPhase } from "@prisma/client";
import { normalizeMainPhaseForWorkflow, phaseOrder } from "@/lib/constants";

export function canTransitionPhase(currentPhase: MainPhase, nextPhase: MainPhase) {
  const currentIndex = phaseOrder.indexOf(normalizeMainPhaseForWorkflow(currentPhase));
  const nextIndex = phaseOrder.indexOf(normalizeMainPhaseForWorkflow(nextPhase));

  if (currentIndex === -1 || nextIndex === -1) {
    return false;
  }

  const delta = nextIndex - currentIndex;
  if (delta === 0) {
    return true;
  }

  return Math.abs(delta) <= 1;
}

export function getSelectablePhaseTargets(currentPhase: MainPhase) {
  return phaseOrder.filter((phase) => canTransitionPhase(currentPhase, phase));
}
