import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestionale 28 Print",
    short_name: "28 Print",
    description: "Gestionale ordini e notifiche shop online 28 Print",
    start_url: "/",
    display: "standalone",
    background_color: "#071a3d",
    theme_color: "#071a3d",
    icons: [
      {
        src: "/shop/stampa-documenti-illustration.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
