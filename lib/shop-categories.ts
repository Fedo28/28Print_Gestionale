export type ShopCategoryProduct = {
  href?: string;
  imageAlt?: string;
  imageSrc?: string;
  label: string;
  note?: string;
  ready?: boolean;
  secondaryImageAlt?: string;
  secondaryImageSrc?: string;
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
      {
        href: "/shop/servizi/biglietti-da-visita",
        imageAlt: "Biglietti da visita stampati",
        imageSrc: "/shop/product-biglietti-visita.jpg",
        label: "Biglietti da visita",
        note: "Formato, carta, quantità",
        ready: true
      },
      {
        href: "/shop/servizi/volantini",
        imageAlt: "Volantini stampati",
        imageSrc: "/shop/product-volantini.jpg",
        label: "Volantini",
        note: "10x21 o 15x21",
        ready: true
      },
      {
        href: "/shop/servizi/locandine",
        imageAlt: "Locandine stampate",
        imageSrc: "/shop/product-locandine.jpg",
        label: "Locandine",
        note: "32x45, grammature",
        ready: true
      },
      {
        href: "/shop/servizi/roll-up",
        imageAlt: "Roll Up personalizzato",
        imageSrc: "/shop/product-roll-up.jpg",
        label: "Roll Up",
        note: "Stampa e struttura",
        ready: true
      },
      {
        href: "/shop/servizi/banner-e-striscioni",
        imageAlt: "Striscioni stampati",
        imageSrc: "/shop/product-banner-e-striscioni.jpg",
        label: "Striscioni",
        note: "Misure e finiture",
        ready: true
      },
      {
        href: "/shop/servizi/timbri",
        imageAlt: "Timbri personalizzati",
        imageSrc: "/shop/product-timbri.jpg",
        label: "Timbri",
        note: "Testo e dimensioni",
        ready: true
      },
      {
        href: "/shop/servizi/adesivi-e-vetrofanie",
        imageAlt: "Adesivi grande formato in stampa",
        imageSrc: "/shop/product-adesivi-grande-formato.jpg",
        label: "Adesivi grande formato",
        note: "Vinili, vetrofanie e taglio",
        ready: true
      },
      {
        href: "/shop/servizi/etichette-adesive",
        imageAlt: "Etichette adesive colorate",
        imageSrc: "/shop/product-etichette-adesive.jpg",
        label: "Etichette adesive",
        note: "Prodotti, pacchi e negozi",
        ready: true
      }
    ],
    slug: "per-la-tua-attivita",
    title: "Per la tua attività"
  },
  {
    accent: "lime",
    imageSrc: "/shop/category-photo-mockup.svg",
    products: [
      { href: "/shop/servizi/stampa-foto", label: "Stampa foto", note: "Piccolo formato", ready: true },
      {
        href: "/shop/servizi/poster-fotografici",
        imageAlt: "Poster fotografico stampato",
        imageSrc: "/shop/product-poster.jpg",
        label: "Poster fotografici",
        note: "Medio e grande formato",
        ready: true
      },
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
      {
        href: "/shop/servizi/etichette-adesive",
        imageAlt: "Etichette adesive colorate",
        imageSrc: "/shop/product-etichette-adesive.jpg",
        label: "Etichette adesive",
        note: "Per packaging e gadget",
        ready: true
      },
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
