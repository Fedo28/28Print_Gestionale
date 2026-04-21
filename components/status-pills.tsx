import Link from "next/link";
import { MainPhase, OperationalStatus, PaymentStatus } from "@prisma/client";
import type { ReactNode } from "react";
import { mainPhaseLabels, normalizeMainPhaseForWorkflow, operationalStatusLabels, paymentStatusLabels } from "@/lib/constants";
import { buildOrdersFilterHref } from "@/lib/order-filters";

function PillLink({
  href,
  className,
  children,
  linked
}: {
  href: string;
  className: string;
  children: ReactNode;
  linked: boolean;
}) {
  return linked ? (
    <Link className={className} href={href} prefetch={false}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

export function StatusPills({
  phase,
  status,
  payment,
  isQuote = false,
  hideNeutralStatus = false,
  linked = true
}: {
  phase: MainPhase;
  status: OperationalStatus;
  payment: PaymentStatus;
  isQuote?: boolean;
  hideNeutralStatus?: boolean;
  linked?: boolean;
}) {
  const visiblePhase = normalizeMainPhaseForWorkflow(phase);

  return (
    <div className="toolbar status-pills">
      {isQuote ? (
        <PillLink className="pill quote" href="/quotes" linked={linked}>
          Preventivo
        </PillLink>
      ) : null}
      <PillLink className="pill phase" href={buildOrdersFilterHref({ phase: visiblePhase })} linked={linked}>
        {mainPhaseLabels[visiblePhase]}
      </PillLink>
      {hideNeutralStatus && status === "ATTIVO" ? null : (
        <PillLink
          className={`pill ${status === "ATTIVO" ? "status" : "warning"}`}
          href={buildOrdersFilterHref({ status })}
          linked={linked}
        >
          {operationalStatusLabels[status]}
        </PillLink>
      )}
      <PillLink
        className={`pill ${payment === "PAGATO" ? "status" : payment === "NON_PAGATO" ? "danger" : "warning"}`}
        href={buildOrdersFilterHref({ payment })}
        linked={linked}
      >
        {paymentStatusLabels[payment]}
      </PillLink>
    </div>
  );
}
