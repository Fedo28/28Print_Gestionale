import Link from "next/link";
import { notFound } from "next/navigation";
import { acceptShopSalesOrderAction } from "@/app/actions";
import { HistoryBackButton } from "@/components/history-back-button";
import { PageHeader } from "@/components/page-header";
import { formatAttachmentSize } from "@/lib/attachment-utils";
import { requireAuth } from "@/lib/auth";
import { formatCurrency, formatDateTime, formatQuantity } from "@/lib/format";
import { buildOrdersFilterHref } from "@/lib/order-filters";
import { prisma } from "@/lib/prisma";
import {
  buildShopDocumentBundleOverview,
  buildShopDocumentCardSummary,
  extractShopDocumentBundleFromConfiguration
} from "@/lib/shop-print-config";

export const dynamic = "force-dynamic";

const salesOrderStatusLabels = {
  DRAFT: "Bozza",
  PENDING_PAYMENT: "Pagamento",
  PAID: "Pagato",
  PAYMENT_FAILED: "Fallito",
  CANCELLED: "Annullato",
  FULFILLED: "Chiuso"
} as const;

function getShopFileStaffDownloadHref(fileAssetId: string) {
  return `/api/orders/shop-files/${fileAssetId}`;
}

export default async function ShopOrderPreviewPage({ params }: { params: { id: string } }) {
  await requireAuth();

  const salesOrder = await prisma.salesOrder.findUnique({
    where: {
      id: params.id
    },
    include: {
      billingSnapshot: true,
      customer: true,
      items: {
        orderBy: {
          createdAt: "asc"
        },
        include: {
          files: {
            orderBy: {
              createdAt: "asc"
            },
            include: {
              fileAsset: true
            }
          },
          serviceCatalog: true
        }
      },
      jobLinks: {
        orderBy: {
          createdAt: "asc"
        },
        include: {
          order: {
            select: {
              id: true,
              orderCode: true,
              title: true
            }
          }
        }
      }
    }
  });

  if (!salesOrder || salesOrder.origin !== "SHOP_ONLINE") {
    notFound();
  }

  const linkedOrder = salesOrder.jobLinks[0]?.order || null;
  const canAcceptOrder = !linkedOrder && salesOrder.status === "PAID";
  const documentBundles = salesOrder.items
    .map((item) => extractShopDocumentBundleFromConfiguration(item.configuration, Number(item.quantity)))
    .filter((bundle): bundle is NonNullable<typeof bundle> => Boolean(bundle));
  const documentCount = documentBundles.reduce((sum, bundle) => sum + bundle.documents.length, 0);
  const printUnits = documentBundles.reduce((sum, bundle) => sum + bundle.totalPrintUnits, 0);
  const files = salesOrder.items.flatMap((item) => item.files.map((file) => file.fileAsset));
  const billingName =
    salesOrder.billingSnapshot?.companyName ||
    salesOrder.billingSnapshot?.fullName ||
    [salesOrder.billingSnapshot?.firstName, salesOrder.billingSnapshot?.lastName].filter(Boolean).join(" ") ||
    null;

  return (
    <div className="stack order-detail-page-shell order-detail-shop-preview-page">
      <PageHeader
        title="Ordine shop"
        action={
          <div className="order-detail-header-actions order-detail-header-actions-simple">
            {canAcceptOrder ? (
              <form action={acceptShopSalesOrderAction} className="order-detail-shop-accept-form">
                <input name="salesOrderId" type="hidden" value={salesOrder.id} />
                <button className="button primary" type="submit">
                  Accetta ordine
                </button>
              </form>
            ) : null}
            {linkedOrder ? (
              <Link className="button primary" href={`/orders/${linkedOrder.id}`}>
                Apri commessa
              </Link>
            ) : null}
            <HistoryBackButton className="button ghost" fallbackHref={buildOrdersFilterHref({ shop: "ONLINE", preset: "TO_DO" })} label="Torna indietro" />
          </div>
        }
      />

      <section className="order-detail-command-card tone-lime">
        <div className="order-detail-command-main">
          <span className="order-detail-command-kicker">Shop online</span>
          <h3 className="order-detail-command-title">{salesOrder.customer.name}</h3>
          <div className="order-detail-command-meta-strip">
            <span>{salesOrder.orderCode}</span>
            <span>{salesOrderStatusLabels[salesOrder.status]}</span>
            <span>{formatDateTime(salesOrder.placedAt || salesOrder.createdAt)}</span>
            <span className="pill compact-pill shop-online-pill">Shop online</span>
          </div>
        </div>

        <div className="order-detail-command-stats">
          <span className="order-detail-command-stat is-emerald">
            <span>Documenti</span>
            <strong>{documentCount || salesOrder.items.length}</strong>
            <small>{files.length} file</small>
          </span>
          <span className="order-detail-command-stat is-sky">
            <span>Stampa</span>
            <strong>{printUnits || formatQuantity(salesOrder.items.reduce((sum, item) => sum + Number(item.quantity), 0))}</strong>
            <small>Pagine</small>
          </span>
          <span className="order-detail-command-stat is-slate">
            <span>Totale</span>
            <strong>{formatCurrency(salesOrder.totalCents)}</strong>
            <small>{salesOrder.invoiceRequested ? "Fattura richiesta" : "Nessuna fattura"}</small>
          </span>
        </div>
      </section>

      <section className="card card-pad order-detail-shop-online-card" id="shop-online-panel">
        <div className="order-detail-shop-online-head">
          <div>
            <h3>Shop online</h3>
            <span className="subtle">{salesOrder.orderCode}</span>
          </div>
          <Link className="button ghost" href={buildOrdersFilterHref({ shop: "ONLINE", preset: "TO_DO" })} prefetch={false}>
            Ordini shop
          </Link>
        </div>

        <div className="order-detail-shop-online-summary">
          <span>
            <strong>{documentCount || salesOrder.items.length}</strong>
            <small>Documenti</small>
          </span>
          <span>
            <strong>{printUnits || formatQuantity(salesOrder.items.reduce((sum, item) => sum + Number(item.quantity), 0))}</strong>
            <small>Pagine stampa</small>
          </span>
          <span>
            <strong>{formatCurrency(salesOrder.totalCents)}</strong>
            <small>Totale</small>
          </span>
          <span>
            <strong>{salesOrder.invoiceRequested ? "Si" : "No"}</strong>
            <small>Fattura</small>
          </span>
        </div>

        <details className="order-detail-shop-online-details" open>
          <summary>
            <span>Preferenze e file</span>
            <strong>{files.length} file</strong>
          </summary>
          <div className="order-detail-shop-online-grid">
            <div className="order-detail-shop-online-block">
              <strong>Preferenze</strong>
              <div className="mini-list">
                {salesOrder.items.map((item) => {
                  const documentBundle = extractShopDocumentBundleFromConfiguration(item.configuration, Number(item.quantity));

                  return (
                    <article className="mini-item order-detail-shop-item" key={item.id}>
                      <div className="list-header">
                        <strong>{item.label}</strong>
                        <span className="pill compact-pill">{formatQuantity(item.quantity)}</span>
                      </div>
                      {documentBundle ? <div className="subtle">{buildShopDocumentBundleOverview(documentBundle)}</div> : null}
                      {documentBundle?.documents.map((document) => (
                        <div className="order-detail-shop-document-line" key={`${item.id}-${document.id}`}>
                          <span>{document.name}</span>
                          <small>{buildShopDocumentCardSummary(document, { compact: true })}</small>
                        </div>
                      ))}
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="order-detail-shop-online-block">
              <strong>File</strong>
              {files.length ? (
                <div className="mini-list">
                  {files.map((file) => (
                    <a className="mini-item order-detail-shop-file-link" href={getShopFileStaffDownloadHref(file.id)} key={file.id}>
                      <strong>{file.originalName}</strong>
                      <span className="subtle">{formatAttachmentSize(file.fileSize)}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="empty">Nessun file collegato.</div>
              )}
              {salesOrder.notes?.trim() || billingName ? (
                <div className="order-detail-shop-customer-note">
                  <strong>{billingName || "Nota cliente"}</strong>
                  {salesOrder.notes?.trim() ? <p>{salesOrder.notes}</p> : null}
                </div>
              ) : null}
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
