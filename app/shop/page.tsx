import Image from "next/image";
import Link from "next/link";
import { ShopWheelCarousel } from "@/components/shop-wheel-carousel";
import { listShopHomeCategories } from "@/lib/shop-categories";

export const dynamic = "force-dynamic";

type ShopHomeIconName = "account" | "cart" | "documents" | "home";

const bottomNavItems: Array<{
  disabled?: boolean;
  href?: string;
  icon: ShopHomeIconName;
  label: string;
}> = [
  { href: "/shop", icon: "home", label: "Home" },
  { href: "/shop/stampa-documenti", icon: "documents", label: "Documenti" },
  { disabled: true, icon: "cart", label: "Carrello" },
  { href: "/shop/account", icon: "account", label: "Area" }
];

function ShopHomeIcon({ name }: { name: ShopHomeIconName }) {
  if (name === "documents") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="M7 3h7l3 3v15H7V3Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9.5 12h5" stroke="currentColor" strokeLinecap="square" strokeWidth="1.8" />
        <path d="M9.5 16h4" stroke="currentColor" strokeLinecap="square" strokeWidth="1.8" />
      </svg>
    );
  }

  if (name === "cart") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="M5 6h2l2 9h8l2-6H8" stroke="currentColor" strokeLinecap="square" strokeWidth="1.8" />
        <path d="M10 20h.01M17 20h.01" stroke="currentColor" strokeLinecap="square" strokeWidth="3" />
      </svg>
    );
  }

  if (name === "account") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 21a7 7 0 0 1 14 0" stroke="currentColor" strokeLinecap="square" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M4 11.5 12 4l8 7.5V21h-5v-6H9v6H4v-9.5Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default async function ShopHomePage() {
  const categories = listShopHomeCategories();

  return (
    <div className="shop-page-shell shop-home-minimal shop-home-app">
      <section className="shop-home-hero" aria-label="Shop 28 Print">
        <h1 aria-label="Immagina, crea, personalizza">
          <span aria-hidden="true">Immagina,</span>
          <span aria-hidden="true">crea,</span>
          <span aria-hidden="true">personalizza</span>
        </h1>
      </section>

      <Link className="shop-home-document-cta" href="/shop/stampa-documenti">
        <span className="shop-home-document-cta-copy">
          <span className="shop-home-document-cta-icon">
            <ShopHomeIcon name="documents" />
          </span>
          <strong>Stampa i tuoi documenti</strong>
        </span>
        <Image
          alt=""
          aria-hidden="true"
          className="shop-home-document-cta-illustration"
          height={1254}
          priority
          sizes="(max-width: 720px) 250px, 390px"
          src="/shop/stampa-documenti-illustration.png"
          width={1254}
        />
      </Link>

      <section className="shop-home-carousel-stack" id="shop-services" aria-label="Servizi shop">
        {categories.map((category) => (
          <section className={`shop-home-carousel-block is-${category.accent}`} key={category.slug}>
            <div className="shop-home-carousel-head">
              <h2>{category.title}</h2>
            </div>

            <ShopWheelCarousel className="shop-home-carousel" ariaLabel={`Servizi ${category.title}`}>
              {category.products.map((product) => (
                <Link
                  className="shop-home-service-pill"
                  href={product.href || `/shop/categorie/${category.slug}`}
                  key={product.label}
                >
                  <span>{product.label}</span>
                </Link>
              ))}
            </ShopWheelCarousel>
          </section>
        ))}
      </section>

      <nav className="shop-bottom-nav" aria-label="Navigazione rapida shop">
        {bottomNavItems.map((item) =>
          item.disabled ? (
            <button
              aria-disabled="true"
              className="shop-bottom-nav-link is-muted"
              key={item.label}
              type="button"
            >
              <ShopHomeIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ) : (
            <Link
              aria-current={item.href === "/shop" ? "page" : undefined}
              className={`shop-bottom-nav-link${item.href === "/shop" ? " is-active" : ""}`}
              href={item.href || "/shop"}
              key={item.label}
            >
              <ShopHomeIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          )
        )}
      </nav>
    </div>
  );
}
