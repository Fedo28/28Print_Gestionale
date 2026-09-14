import Image from "next/image";
import Link from "next/link";
import { listShopHomeCategories } from "@/lib/shop-categories";

export const dynamic = "force-dynamic";

export default async function ShopHomePage() {
  const categories = listShopHomeCategories();

  return (
    <div className="shop-page-shell shop-home-minimal">
      <section className="shop-home-heading-strip" aria-label="Introduzione shop">
        <h1>Scegli cosa stampare</h1>
      </section>

      <section className="shop-home-service-board" aria-label="Servizi shop">
        <Link className="shop-home-service-card is-primary" href="/shop/stampa-documenti">
          <div className="shop-home-service-card-copy">
            <strong>Stampa documenti</strong>
          </div>
          <Image
            alt=""
            aria-hidden="true"
            className="shop-home-service-card-illustration"
            height={1254}
            priority
            sizes="(max-width: 720px) 220px, 320px"
            src="/shop/stampa-documenti-illustration.png"
            width={1254}
          />
        </Link>

        {categories.map((category) => (
          <Link
            className={`shop-home-service-card shop-home-category-card is-${category.accent}`}
            href={`/shop/categorie/${category.slug}`}
            key={category.slug}
            style={{ backgroundImage: `url(${category.imageSrc})` }}
          >
            <div className="shop-home-service-card-copy">
              <span>{category.products.length} servizi</span>
              <strong>{category.title}</strong>
            </div>
          </Link>
        ))}
      </section>

      <Link className="shop-home-account-strip" href="/shop/account">
        <span>Area cliente</span>
        <strong>I tuoi ordini</strong>
      </Link>
    </div>
  );
}
