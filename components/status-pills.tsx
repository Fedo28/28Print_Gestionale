import Link from "next/link";
import { MainPhase, OperationalStatus, PaymentStatus } from "@prisma/client";
import { mainPhaseLabels, operationalStatusLabels, paymentStatusLabels } from "@/lib/constants";
import { buildOrdersFilterHref } from "@/lib/order-filters";

export function StatusPills({
  phase,
  status,
  payment,
  isQuote = false
}: {
  phase: MainPhase;
  status: OperationalStatus;
  payment: PaymentStatus;
  isQuote?: boolean;
}) {
  return (
    <div className="toolbar">
      {isQuote ? (
        <Link className="pill quote" href={buildOrdersFilterHref({ quote: "QUOTE" })} prefetch={false}>
          Preventivo
        </Link>
      ) : null}
      <Link className="pill phase" href={buildOrdersFilterHref({ phase })} prefetch={false}>
        {mainPhaseLabels[phase]}
      </Link>
      <Link
        className={`pill ${status === "ATTIVO" ? "status" : "warning"}`}
        href={buildOrdersFilterHref({ status })}
        prefetch={false}
      >
        {operationalStatusLabels[status]}
      </Link>
      <Link
        className={`pill ${payment === "PAGATO" ? "status" : payment === "NON_PAGATO" ? "danger" : "warning"}`}
        href={buildOrdersFilterHref({ payment })}
        prefetch={false}
      >
        {paymentStatusLabels[payment]}
      </Link>
    </div>
  );
}
