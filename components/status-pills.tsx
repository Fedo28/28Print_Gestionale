import { MainPhase, OperationalStatus, PaymentStatus } from "@prisma/client";
import { mainPhaseLabels, operationalStatusLabels, paymentStatusLabels } from "@/lib/constants";

export function StatusPills({
  phase,
  status,
  payment
}: {
  phase: MainPhase;
  status: OperationalStatus;
  payment: PaymentStatus;
}) {
  return (
    <div className="toolbar">
      <span className="pill phase">{mainPhaseLabels[phase]}</span>
      <span className={`pill ${status === "ATTIVO" ? "status" : "warning"}`}>{operationalStatusLabels[status]}</span>
      <span className={`pill ${payment === "PAGATO" ? "status" : payment === "NON_PAGATO" ? "danger" : "warning"}`}>
        {paymentStatusLabels[payment]}
      </span>
    </div>
  );
}
