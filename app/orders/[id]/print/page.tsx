import Image from "next/image";
import { notFound } from "next/navigation";
import logoImage from "@/logo.png";
import { AutoPrintOnLoad } from "@/components/auto-print-on-load";
import { requireAuth } from "@/lib/auth";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/format";
import { getOrderById } from "@/lib/orders";

function getCustomerPrimaryContact(order: Awaited<ReturnType<typeof getOrderById>>) {
  if (!order) {
    return null;
  }

  return order.customer.phone?.trim() || order.customer.whatsapp?.trim() || null;
}

export default async function OrderPrintPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { autoprint?: string };
}) {
  await requireAuth();
  const order = await getOrderById(params.id);

  if (!order) {
    notFound();
  }

  const customerPrimaryContact = getCustomerPrimaryContact(order);

  return (
    <div className="print-preview-page">
      {searchParams?.autoprint === "1" ? <AutoPrintOnLoad /> : null}
      <article className="print-sheet print-sheet-minimal">
        <header className="print-sheet-minimal-header">
          <div className="print-sheet-logo">
            <Image
              className="print-sheet-logo-image"
              src={logoImage}
              alt="28 Print"
              priority
            />
          </div>

          <section className="print-sheet-section print-sheet-doc-type">
            <strong>{order.isQuote ? "preventivo" : "ordine"}</strong>
          </section>
        </header>

        <section className="print-sheet-section print-sheet-customer-block">
          <strong className="print-sheet-customer-name">{order.customer.name}</strong>
          {customerPrimaryContact ? <span>{customerPrimaryContact}</span> : null}
          {order.customer.email?.trim() ? <span>{order.customer.email.trim()}</span> : null}
        </section>

        <section className="print-sheet-section print-sheet-lines-block">
          <table className="print-sheet-table print-sheet-lines-table">
            <thead>
              <tr>
                <th>Descrizione</th>
                <th>Qta</th>
                <th>Prezzo</th>
                <th>Totale</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td>{formatQuantity(item.quantity)}</td>
                  <td>{formatCurrency(item.unitPriceCents)}</td>
                  <td>{formatCurrency(item.lineTotalCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={3}>Totale ordine</th>
                <th>{formatCurrency(order.totalCents)}</th>
              </tr>
            </tfoot>
          </table>
        </section>

        <section className="print-sheet-section print-sheet-total-block">
          <span>Totale</span>
          <strong>{formatCurrency(order.totalCents)}</strong>
        </section>

        <section className="print-sheet-section print-sheet-delivery-block">
          <span>Consegna prevista</span>
          <strong>{formatDate(order.deliveryAt)}</strong>
        </section>

        <footer className="print-sheet-footer">
          <div className="print-sheet-footer-meta">
            <span>28 Print di Edoardo Polichetti - Via Nomentana 114 Mentana (RM) - P. IVA 15829801008</span>
            <span>28print.it - info@28print.it - 06.86296919</span>
          </div>
          <div className="print-sheet-footer-rule" aria-hidden="true" />
          <div className="print-sheet-footer-services">
            <span>Realizzazioni Grafiche - Campagne Pubblicitarie - Cartellonistica</span>
            <span>Stampe Digitali - Siti Web - Abbigliamento Personalizzato - Stampe e Ricami</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
