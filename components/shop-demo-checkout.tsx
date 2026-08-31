"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type DemoCheckoutResponse = {
  success: true;
};

type StripeCheckoutResponse =
  | {
      checkoutUrl: string;
      success: true;
    }
  | {
      error?: string;
    };

type ShopDemoCheckoutProps = {
  amountLabel: string;
  initialNotice?: {
    kind: "success" | "error";
    message: string;
  } | null;
  initialOpen: boolean;
  isCompleted: boolean;
  orderId: string;
  stripeEnabled?: boolean;
  stripeMode?: "demo" | "live" | "test";
};

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function ShopDemoCheckout({
  amountLabel,
  initialNotice = null,
  initialOpen,
  isCompleted,
  orderId,
  stripeEnabled = false,
  stripeMode = "demo"
}: ShopDemoCheckoutProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(initialOpen && !isCompleted);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(initialNotice);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 10_000);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/shop/orders/${orderId}/demo-checkout`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as DemoCheckoutResponse | { error?: string } | null;

      if (!response.ok || !payload || !("success" in payload)) {
        throw new Error(payload && "error" in payload ? payload.error : "Pagamento non riuscito.");
      }

      setIsOpen(false);
      setNotice({
        kind: "success",
        message: "Ordine andato a buon fine."
      });
      router.refresh();
    } catch (error) {
      setNotice({
        kind: "error",
        message: getRequestErrorMessage(error, "C'e stato qualche problema.")
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStripeCheckout() {
    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/shop/orders/${orderId}/stripe-checkout`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as StripeCheckoutResponse | null;

      if (!response.ok || !payload || !("success" in payload) || !payload.checkoutUrl) {
        throw new Error(payload && "error" in payload ? payload.error : "Pagamento non disponibile.");
      }

      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setNotice({
        kind: "error",
        message: getRequestErrorMessage(error, "C'e stato qualche problema.")
      });
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className={`shop-card shop-demo-checkout-card${isCompleted ? " is-complete" : ""}`}>
        <div className="shop-demo-checkout-main">
          <div>
            <span className="pill">
              {isCompleted ? "Pagato" : stripeEnabled ? `Pagamento Stripe ${stripeMode === "live" ? "live" : "test"}` : "Pagamento demo"}
            </span>
            <h2>{isCompleted ? "Ordine confermato" : "Completa il pagamento"}</h2>
          </div>
          <strong>{amountLabel}</strong>
        </div>

        <div className="button-row">
          {isCompleted ? (
            <Link className="button primary" href="/shop/stampa-documenti">
              Nuovo ordine
            </Link>
          ) : stripeEnabled ? (
            <button className="button primary" disabled={isSubmitting} onClick={handleStripeCheckout} type="button">
              {isSubmitting ? "Apro Stripe..." : "Paga con carta"}
            </button>
          ) : (
            <button className="button primary" onClick={() => setIsOpen(true)} type="button">
              Inserisci dati pagamento demo
            </button>
          )}
          <Link className="button ghost" href="/shop/account">
            Area cliente
          </Link>
        </div>
      </section>

      {isOpen ? (
        <div className="shop-demo-checkout-modal" role="dialog" aria-modal="true" aria-labelledby="shop-demo-checkout-title">
          <div className="shop-demo-checkout-dialog">
            <div className="list-header">
              <div>
                <span className="pill">Pagamento</span>
                <h3 id="shop-demo-checkout-title">Dati carta</h3>
              </div>
              <strong>{amountLabel}</strong>
            </div>

            <form className="shop-demo-checkout-form" onSubmit={handleSubmit}>
              <label className="field full" htmlFor="shop-demo-card-name">
                <span>Nome sulla carta</span>
                <input autoComplete="cc-name" defaultValue="Mario Rossi" id="shop-demo-card-name" required type="text" />
              </label>
              <label className="field full" htmlFor="shop-demo-card-number">
                <span>Numero carta</span>
                <input
                  autoComplete="cc-number"
                  defaultValue="4242 4242 4242 4242"
                  id="shop-demo-card-number"
                  inputMode="numeric"
                  required
                  type="text"
                />
              </label>
              <div className="shop-demo-checkout-fields">
                <label className="field" htmlFor="shop-demo-card-expiry">
                  <span>Scadenza</span>
                  <input autoComplete="cc-exp" defaultValue="12/30" id="shop-demo-card-expiry" required type="text" />
                </label>
                <label className="field" htmlFor="shop-demo-card-cvc">
                  <span>CVC</span>
                  <input autoComplete="cc-csc" defaultValue="123" id="shop-demo-card-cvc" inputMode="numeric" required type="text" />
                </label>
              </div>
              <div className="button-row">
                <button className="button primary" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Pagamento..." : "Conferma pagamento"}
                </button>
                <button className="button ghost" disabled={isSubmitting} onClick={() => setIsOpen(false)} type="button">
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className={`shop-demo-checkout-toast is-${notice.kind}`} role="status">
          <strong>{notice.message}</strong>
        </div>
      ) : null}
    </>
  );
}
