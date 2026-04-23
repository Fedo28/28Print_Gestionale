/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NODE_ENV === "production" ? ".next" : ".next-dev",
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb"
    }
  },
  async headers() {
    if (process.env.NODE_ENV === "production") {
      return [];
    }

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" }
        ]
      }
    ];
  }
};

export default nextConfig;
