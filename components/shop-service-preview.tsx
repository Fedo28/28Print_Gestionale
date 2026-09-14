import Link from "next/link";
import { ShopDocumentConfigurator } from "@/components/shop-document-configurator";
import { getCustomerAccountSession } from "@/lib/customer-account-auth";
import type { ShopPublishedService } from "@/lib/shop-catalog";

function BackArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M15 6 9 12l6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

export function ShopServicePreview({
  expectedSlug,
  quantity,
  service,
  title
}: {
  expectedSlug?: string;
  quantity: number;
  service: ShopPublishedService | null;
  title: string;
}) {
  const customerSession = getCustomerAccountSession();
  const sourcePath = expectedSlug ? `/shop/${expectedSlug === "stampa-documenti" ? "stampa-documenti" : `servizi/${expectedSlug}`}` : "/shop";

  return (
    <div className="shop-page-shell shop-service-shell">
      <section className="shop-service-title-strip">
        <Link className="shop-back-link shop-back-link-icon" href="/shop" aria-label="Torna alla home shop">
          <BackArrowIcon />
        </Link>
        <div>
          <h1>{title}</h1>
        </div>
      </section>

      {service ? (
        <ShopDocumentConfigurator
          customerSignedIn={Boolean(customerSession)}
          displayName={title}
          initialQuantity={quantity}
          service={service}
          sourcePath={sourcePath}
        />
      ) : (
        <section className="shop-card">
          <div className="empty">Nessun servizio disponibile per questa pagina.</div>
        </section>
      )}
    </div>
  );
}
