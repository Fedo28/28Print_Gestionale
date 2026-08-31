import Link from "next/link";
import { notFound } from "next/navigation";
import { ShopDemoCheckout } from "@/components/shop-demo-checkout";
import { formatCurrency, formatQuantity } from "@/lib/format";
import { requireCustomerAccountAuth } from "@/lib/customer-account-auth";
import {
  getShopStripeCheckoutAvailability,
  syncShopStripeCheckoutSessionForCustomer
} from "@/lib/shop-payments";
import {
  buildShopDocumentCardSummary,
  extractShopDocumentBundleFromConfiguration,
  formatShopPrintedPagesLabel
} from "@/lib/shop-print-config";
import { getCustomerAccountShopOrderDetail } from "@/lib/shop-orders";

export const dynamic = "force-dynamic";

const salesOrderStatusLabels = {
  DRAFT: "Bozza",
  PENDING_PAYMENT: "In attesa di pagamento",
  PAID: "Pagato",
  PAYMENT_FAILED: "Pagamento fallito",
  CANCELLED: "Annullato",
  FULFILLED: "Completato"
} as const;

const billingKindLabels = {
  PRIVATE: "Privato",
  PROFESSIONAL: "Professionista",
  BUSINESS: "Azienda"
} as const;

export default async function ShopOrderDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { checkout?: string; session_id?: string };
}) {
  const session = await requireCustomerAccountAuth();

  if (searchParams?.session_id) {
    await syncShopStripeCheckoutSessionForCustomer({
      checkoutSessionId: searchParams.session_id,
      customerAccountId: session.customerAccountId
    }).catch(() => null);
  }

  const order = await getCustomerAccountShopOrderDetail(params.id, session.customerAccountId);

  if (!order) {
    notFound();
  }

  const billingAddress = order.billingSnapshot
    ? [
        order.billingSnapshot.addressLine1,
        order.billingSnapshot.addressLine2,
        [order.billingSnapshot.postalCode, order.billingSnapshot.city, order.billingSnapshot.province]
          .filter(Boolean)
          .join(" "),
        order.billingSnapshot.country
      ]
        .filter(Boolean)
        .join(" • ")
    : "";
  const billingIdentifiers = order.billingSnapshot
    ? [
        order.billingSnapshot.phone || null,
        order.billingSnapshot.vatNumber ? `P. IVA ${order.billingSnapshot.vatNumber}` : null,
        order.billingSnapshot.taxCode ? `CF ${order.billingSnapshot.taxCode}` : null
      ].filter(Boolean)
    : [];
  const billingDeliveryChannel = order.billingSnapshot
    ? [
        order.billingSnapshot.pec ? `PEC ${order.billingSnapshot.pec}` : null,
        order.billingSnapshot.sdiCode ? `CU ${order.billingSnapshot.sdiCode}` : null
      ].filter(Boolean)
    : [];
  const documentBundles = order.items
    .map((item) => extractShopDocumentBundleFromConfiguration(item.configuration, Number(item.quantity)))
    .filter((bundle): bundle is NonNullable<typeof bundle> => Boolean(bundle));
  const totalDocuments = documentBundles.reduce((sum, bundle) => sum + bundle.documents.length, 0);
  const totalPrintedPages =
    documentBundles.reduce((sum, bundle) => sum + bundle.totalPrintUnits, 0) ||
    order.items.reduce((sum, item) => sum + Math.max(1, Math.round(Number(item.quantity) || 0)), 0);
  const isCheckoutComplete = order.status === "PAID" || order.status === "FULFILLED";
  const stripeCheckoutAvailability = getShopStripeCheckoutAvailability();
  const initialCheckoutNotice =
    searchParams?.checkout === "cancelled"
      ? {
          kind: "error" as const,
          message: "Pagamento annullato."
        }
      : searchParams?.checkout === "success" && isCheckoutComplete
        ? {
            kind: "success" as const,
            message: "Ordine andato a buon fine."
          }
        : null;

  return (
    <div className="shop-page-shell">
      <ShopDemoCheckout
        amountLabel={formatCurrency(order.totalCents)}
        initialNotice={initialCheckoutNotice}
        initialOpen={searchParams?.checkout === "1" && !isCheckoutComplete}
        isCompleted={isCheckoutComplete}
        orderId={order.id}
        stripeEnabled={stripeCheckoutAvailability.enabled}
        stripeMode={stripeCheckoutAvailability.mode}
      />

      {isCheckoutComplete ? (
        <>
          <section className="shop-card shop-order-summary-head">
            <div className="list-header">
              <div>
                <span className="pill">{salesOrderStatusLabels[order.status] || order.status}</span>
                <h1>{order.orderCode}</h1>
              </div>
              <Link className="button primary" href="/shop/stampa-documenti">
                Nuovo ordine
              </Link>
            </div>

            <div className="shop-hero-metrics">
              <article className="shop-metric-card">
                <span>Documenti</span>
                <strong>{totalDocuments || order.items.length}</strong>
                <p>{formatShopPrintedPagesLabel(totalPrintedPages)}</p>
              </article>
              <article className="shop-metric-card">
                <span>Totale</span>
                <strong>{formatCurrency(order.totalCents)}</strong>
                <p>{order.invoiceRequested ? "Fattura richiesta" : "Nessuna fattura"}</p>
              </article>
            </div>
          </section>

          <div className="shop-grid">
            <details className="shop-card shop-card-wide shop-order-documents-disclosure">
              <summary>
                <div>
                  <h3>Documenti da stampare</h3>
                </div>
                <span className="pill">{order.items.length}</span>
              </summary>

              <div className="shop-order-list">
                {order.items.map((item) => {
                  const documentBundle = extractShopDocumentBundleFromConfiguration(item.configuration, Number(item.quantity));

                  return (
                    <article className="mini-item" key={item.id}>
                      <div className="shop-order-list-head">
                        <div>
                          <strong>{item.label}</strong>
                          {item.description ? <div className="subtle">{item.description}</div> : null}
                        </div>
                        <div className="shop-order-list-aside">
                          <span className="pill">{formatQuantity(item.quantity)}</span>
                          <strong>{formatCurrency(item.lineTotalCents)}</strong>
                        </div>
                      </div>

                      {documentBundle?.documents.length ? (
                        <div className="shop-order-document-list">
                          {documentBundle.documents.map((document) => (
                            <article className="mini-item" key={`${item.id}-${document.id}`}>
                              <strong>{document.name}</strong>
                              <div className="subtle">
                                {document.pages === 1 ? "1 pagina" : `${formatQuantity(document.pages)} pagine`}
                                {" • "}
                                {document.copies === 1 ? "1 copia" : `${formatQuantity(document.copies)} copie`}
                              </div>
                              <div className="hint">{buildShopDocumentCardSummary(document, { includeCopies: false })}</div>
                            </article>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </details>

            <section className="shop-card shop-order-total-card">
              <div className="list-header">
                <div>
                  <h3>Totale ordine</h3>
                </div>
              </div>
              <strong className="shop-order-total-headline">{formatCurrency(order.totalCents)}</strong>
              <div className="subtle">{order.invoiceRequested ? "Fattura richiesta" : "Fattura non richiesta"}</div>
            </section>
          </div>

          <div className="shop-grid">
            <section className="shop-card">
              <div className="list-header">
                <div>
                  <h3>Cliente</h3>
                </div>
              </div>
              <div className="stack">
                <article className="mini-item">
                  <strong>{order.customer.name}</strong>
                  <div className="subtle">{order.customer.email || session.email}</div>
                  <div className="hint">{order.customer.phone || "Telefono non disponibile"}</div>
                </article>
              </div>
            </section>

            <section className="shop-card">
              <div className="list-header">
                <div>
                  <h3>Fatturazione</h3>
                </div>
              </div>
              {order.billingSnapshot ? (
                <div className="stack">
                  <article className="mini-item">
                    <strong>{order.billingSnapshot.fullName || order.billingSnapshot.companyName || "Profilo fatturazione"}</strong>
                    <div className="subtle">{billingKindLabels[order.billingSnapshot.kind] || order.billingSnapshot.kind}</div>
                    <div className="hint">{billingIdentifiers.join(" • ") || "Dati fattura salvati."}</div>
                    {billingAddress ? <div className="hint">{billingAddress}</div> : null}
                    {billingDeliveryChannel.length ? (
                      <div className="hint">{billingDeliveryChannel.join(" • ")}</div>
                    ) : null}
                  </article>
                </div>
              ) : (
                <div className="empty">Fattura non richiesta.</div>
              )}
            </section>
          </div>

          {order.notes ? (
            <section className="shop-card">
              <div className="list-header">
                <div>
                  <h3>Note ordine</h3>
                </div>
              </div>
              <pre className="shop-order-notes">{order.notes}</pre>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
