export function GET() {
  return Response.json(
    {
      name: "28 Print Shop",
      short_name: "28 Print",
      description: "Stampe e prodotti personalizzati 28 Print",
      start_url: "/shop",
      display: "standalone",
      background_color: "#071a3d",
      theme_color: "#071a3d",
      icons: [
        {
          src: "/shop/stampa-documenti-illustration.png",
          sizes: "760x760",
          type: "image/png"
        }
      ]
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
