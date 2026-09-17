export type ShopCategoryProduct = {
  href?: string;
  label: string;
  note?: string;
  ready?: boolean;
};

export type ShopHomeCategory = {
  accent: "cyan" | "lime" | "red";
  imageSrc: string;
  products: ShopCategoryProduct[];
  slug: string;
  title: string;
};

export const shopHomeCategories: ShopHomeCategory[] = [
  {
    accent: "cyan",
    imageSrc: "/shop/category-business-mockup.svg",
    products: [
      { href: "/shop/servizi/biglietti-da-visita", label: "Biglietti da visita", note: "Formato, carta, quantità", ready: true },
      { href: "/shop/servizi/volantini-e-locandine", label: "Volantini e locandine", note: "A6, A5, A4, A3", ready: true },
      { href: "/shop/servizi/roll-up", label: "Roll-up", note: "Completo o solo stampa", ready: true },
      { href: "/shop/servizi/banner-e-striscioni", label: "Banner e striscioni", note: "Misure e finiture", ready: true },
      { href: "/shop/servizi/timbri", label: "Timbri", note: "Testo e dimensioni", ready: true },
      { href: "/shop/servizi/adesivi-e-vetrofanie", label: "Adesivi e vetrofanie", note: "Piccolo e grande formato", ready: true },
      { href: "/shop/servizi/etichette-adesive", label: "Etichette adesive", note: "Prodotti, pacchi e negozi", ready: true }
    ],
    slug: "per-la-tua-attivita",
    title: "Per la tua attività"
  },
  {
    accent: "lime",
    imageSrc: "/shop/category-photo-mockup.svg",
    products: [
      { href: "/shop/servizi/stampa-foto", label: "Stampa foto", note: "Piccolo formato", ready: true },
      { href: "/shop/servizi/poster-fotografici", label: "Poster fotografici", note: "Medio e grande formato", ready: true },
      { href: "/shop/servizi/canvas-e-tele", label: "Canvas e tele", note: "Con o senza telaio", ready: true },
      { href: "/shop/servizi/quadri-e-pannelli", label: "Quadri e pannelli", note: "Supporti rigidi", ready: true },
      { href: "/shop/servizi/tableau-e-cerimonie", label: "Tableau e cerimonie", note: "Formati speciali", ready: true }
    ],
    slug: "foto-e-quadri",
    title: "Foto e quadri"
  },
  {
    accent: "red",
    imageSrc: "/shop/category-gadget-mockup.svg",
    products: [
      { href: "/shop/servizi/t-shirt-personalizzate", label: "T-shirt personalizzate", note: "Singole o per aziende", ready: true },
      { href: "/shop/servizi/abbigliamento-da-lavoro", label: "Abbigliamento da lavoro", note: "Quantità e loghi", ready: true },
      { href: "/shop/servizi/tazze", label: "Tazze", note: "Foto, scritte e grafiche", ready: true },
      { href: "/shop/servizi/borracce", label: "Borracce", note: "Colori e personalizzazione", ready: true },
      { href: "/shop/servizi/etichette-adesive", label: "Etichette adesive", note: "Per packaging e gadget", ready: true },
      { href: "/shop/servizi/shopper-e-cappellini", label: "Shopper e cappellini", note: "Gadget coordinati", ready: true },
      { href: "/shop/servizi/portachiavi", label: "Portachiavi", note: "Oggettistica rapida", ready: true }
    ],
    slug: "magliette-e-gadget",
    title: "Magliette e gadget"
  }
];

export function listShopHomeCategories() {
  return shopHomeCategories;
}

export function getShopHomeCategory(slug: string) {
  return shopHomeCategories.find((category) => category.slug === slug) || null;
}
