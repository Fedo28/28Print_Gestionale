import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/auth";
import { resolveShopPublicBaseUrl } from "@/lib/domain/commerce/shop-foundation";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getShopStripeCheckoutAvailability } from "@/lib/shop-payments";

export const dynamic = "force-dynamic";

function maskSecretStatus(value?: string) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "mancante";
  }

  const prefix = normalized.slice(0, 7);
  const suffix = normalized.slice(-4);
  return `${prefix}...${suffix}`;
}

export default async function ShopPaymentsSettingsPage() {
  await requireAdmin();

  const availability = getShopStripeCheckoutAvailability();
  const [pendingPaymentCount, paidCount, failedCount, latestPayment] = await Promise.all([
    prisma.salesOrder.count({
      where: {
        origin: "SHOP_ONLINE",
        status: "PENDING_PAYMENT"
      }
    }),
    prisma.salesOrder.count({
      where: {
        origin: "SHOP_ONLINE",
        status: {
          in: ["PAID", "FULFILLED"]
        }
      }
    }),
    prisma.salesOrder.count({
      where: {
        origin: "SHOP_ONLINE",
        status: "PAYMENT_FAILED"
      }
    }),
    prisma.paymentRecord.findFirst({
      orderBy: [{ createdAt: "desc" }],
      select: {
        amountCents: true,
        createdAt: true,
        currency: true,
        providerCheckoutSessionId: true,
        providerPaymentIntentId: true,
        salesOrder: {
          select: {
            orderCode: true
          }
        },
        status: true
      }
    })
  ]);
  const shopBaseUrl = resolveShopPublicBaseUrl(process.env.SHOP_PUBLIC_BASE_URL);
  const webhookPath = "/api/shop/payments/stripe/webhook";
  const webhookUrl = `${shopBaseUrl}${webhookPath}`;

  return (
    <div className="stack">
      <PageHeader
        action={
          <div className="button-row">
            <Link className="button ghost" href="/shop">
              Apri shop
            </Link>
            <Link className="button ghost" href="/orders?shop=online">
              Ordini shop
            </Link>
            <Link className="button ghost" href="/settings">
              Torna alle impostazioni
            </Link>
          </div>
        }
        title="Pagamenti shop"
      />

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Stato Stripe</h3>
          </div>
          <span className="pill">
            {availability.enabled ? `Stripe ${availability.mode}` : "Checkout demo"}
          </span>
        </div>
        <div className="grid grid-2">
          <article className="mini-item">
            <strong>Secret key</strong>
            <div className="subtle">{maskSecretStatus(process.env.STRIPE_SECRET_KEY)}</div>
            <div className="hint">Quando presente abilita il pulsante reale “Paga con carta”.</div>
          </article>
          <article className="mini-item">
            <strong>Webhook secret</strong>
            <div className="subtle">{maskSecretStatus(process.env.STRIPE_WEBHOOK_SECRET)}</div>
            <div className="hint">Serve per fidarsi solo degli eventi firmati da Stripe.</div>
          </article>
          <article className="mini-item">
            <strong>URL pubblico shop</strong>
            <div className="subtle">{shopBaseUrl}</div>
            <div className="hint">In produzione deve puntare a shop.28print.it.</div>
          </article>
          <article className="mini-item">
            <strong>Endpoint webhook</strong>
            <div className="subtle">{webhookUrl}</div>
            <div className="hint">In locale Stripe CLI deve inoltrare gli eventi a {webhookPath}.</div>
          </article>
        </div>
      </section>

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Ordini shop e pagamenti</h3>
          </div>
        </div>
        <div className="grid grid-2">
          <article className="mini-item">
            <strong>{pendingPaymentCount}</strong>
            <div className="subtle">In attesa di pagamento</div>
          </article>
          <article className="mini-item">
            <strong>{paidCount}</strong>
            <div className="subtle">Pagati o completati</div>
          </article>
          <article className="mini-item">
            <strong>{failedCount}</strong>
            <div className="subtle">Pagamento fallito</div>
          </article>
          <article className="mini-item">
            <strong>Ultimo pagamento</strong>
            {latestPayment ? (
              <>
                <div className="subtle">
                  {latestPayment.salesOrder.orderCode} • {latestPayment.status} • {formatCurrency(latestPayment.amountCents)}
                </div>
                <div className="hint">{formatDateTime(latestPayment.createdAt)}</div>
                {latestPayment.providerCheckoutSessionId ? (
                  <div className="hint">Sessione {latestPayment.providerCheckoutSessionId}</div>
                ) : null}
                {latestPayment.providerPaymentIntentId ? (
                  <div className="hint">Payment intent {latestPayment.providerPaymentIntentId}</div>
                ) : null}
              </>
            ) : (
              <div className="subtle">Nessun pagamento registrato.</div>
            )}
          </article>
        </div>
      </section>

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Prova locale Stripe</h3>
          </div>
          <span className="pill">Test mode</span>
        </div>
        <div className="stack">
          <article className="mini-item">
            <strong>1. Configura chiavi test</strong>
            <div className="subtle">Aggiungi `STRIPE_SECRET_KEY=sk_test_...` e `STRIPE_WEBHOOK_SECRET=whsec_...` nel file `.env`.</div>
          </article>
          <article className="mini-item">
            <strong>2. Inoltra webhook locale</strong>
            <div className="subtle">Con Stripe CLI: `stripe listen --forward-to localhost:3000/api/shop/payments/stripe/webhook`.</div>
          </article>
          <article className="mini-item">
            <strong>3. Crea un ordine dallo shop</strong>
            <div className="subtle">Usa carta test `4242 4242 4242 4242`, scadenza futura e CVC qualsiasi.</div>
          </article>
          <article className="mini-item">
            <strong>4. Verifica gestionale</strong>
            <div className="subtle">Dopo il webhook l’ordine deve passare a pagato e comparire negli ordini shop online.</div>
          </article>
        </div>
      </section>
    </div>
  );
}
