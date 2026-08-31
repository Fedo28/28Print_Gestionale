import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { lockShopBetaAccessAction, logoutCustomerAccountAction } from "@/app/shop/actions";
import { ShopBetaAccessForm } from "@/components/shop-beta-access-form";
import { getCustomerAccountSession } from "@/lib/customer-account-auth";
import { getShopBetaGateState } from "@/lib/shop-beta-gate";
import brandLogo from "@/logo.png";

function MenuGlyph() {
  return (
    <svg aria-hidden="true" className="shop-shell-menu-glyph" fill="none" viewBox="0 0 24 24">
      <path d="M4 7h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M4 12h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
      <path d="M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function ShopBetaGate({ configured }: { configured: boolean }) {
  return (
    <section className="shop-beta-gate" aria-label="Accesso beta shop">
      <div className="shop-beta-gate-card">
        <span className="shop-beta-gate-mark">Beta privata</span>
        <div className="shop-beta-gate-copy">
          <h1>Shop in beta controllata</h1>
          <p>
            Stiamo aprendo questa prima versione solo a chi ha il codice, così possiamo provarla con calma prima di renderla pubblica.
          </p>
        </div>

        {configured ? (
          <ShopBetaAccessForm />
        ) : (
          <div className="shop-beta-access-note">
            Codice beta non configurato. Imposta <code>SHOP_BETA_ACCESS_CODE</code> prima di condividere questa pagina.
          </div>
        )}

        <a className="shop-beta-site-link" href="https://www.28print.it/" rel="noreferrer" target="_blank">
          Vai al sito 28Print
        </a>
      </div>
    </section>
  );
}

export default function ShopLayout({ children }: { children: ReactNode }) {
  const betaGate = getShopBetaGateState();
  const isBetaBlocked = betaGate.enabled && !betaGate.allowed;
  const session = isBetaBlocked ? null : getCustomerAccountSession();

  return (
    <div className="shop-shell">
      <header className="shop-shell-header">
        <div className="shop-shell-bar">
          <Link aria-label="Vai alla home shop" className="shop-shell-home" href="/shop">
            <Image alt="28 Print" className="shop-shell-home-logo" priority sizes="56px" src={brandLogo} />
            <div className="shop-shell-home-copy">
              <strong>Shop</strong>
              <p>Immagina, crea, personalizza</p>
            </div>
          </Link>

          <details className="shop-shell-menu">
            <summary aria-label="Apri menu shop" className="shop-shell-menu-trigger">
              <MenuGlyph />
              <span>Menu</span>
            </summary>

            <nav className="shop-shell-menu-panel" aria-label="Navigazione shop">
              <Link className="shop-shell-link" href="/shop">
                Home
              </Link>
              <Link className="shop-shell-link" href="/shop/stampa-documenti">
                Stampa documenti
              </Link>
              <a className="shop-shell-link" href="https://www.28print.it/" rel="noreferrer" target="_blank">
                Vai al sito
              </a>
              {betaGate.enabled && betaGate.allowed ? (
                <form action={lockShopBetaAccessAction}>
                  <button className="button ghost shop-shell-menu-button" type="submit">
                    Blocca beta
                  </button>
                </form>
              ) : null}
              {!isBetaBlocked && session ? (
                <>
                  <Link className="shop-shell-link" href="/shop/account">
                    Area cliente
                  </Link>
                  <form action={logoutCustomerAccountAction}>
                    <button className="button ghost shop-shell-menu-button" type="submit">
                      Esci
                    </button>
                  </form>
                </>
              ) : !isBetaBlocked ? (
                <>
                  <Link className="shop-shell-link" href="/shop/account/login">
                    Accedi
                  </Link>
                  <Link className="button primary shop-shell-menu-button" href="/shop/account/register">
                    Registrati
                  </Link>
                </>
              ) : null}
            </nav>
          </details>
        </div>
      </header>

      <div className="shop-shell-content">
        {isBetaBlocked ? <ShopBetaGate configured={betaGate.configured} /> : children}
      </div>

      <footer className="shop-shell-footer shop-shell-footer-minimal">
        <Link aria-label="Vai alla home shop" className="shop-shell-footer-brand" href="/shop">
          <Image alt="28 Print" className="shop-shell-footer-logo" sizes="48px" src={brandLogo} />
          <div>
            <strong>Shop</strong>
            <p>shop.28print.it</p>
          </div>
        </Link>

        <p>Ordini rapidi, chiari e guidati.</p>
      </footer>
    </div>
  );
}
