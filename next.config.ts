import type { NextConfig } from "next";
import { deploymentIssues } from "./lib/deployment-config";

if (process.env.VERCEL === "1") {
  const issues = deploymentIssues(process.env);
  if (issues.length) throw new Error(`Configuração de hospedagem inválida: ${issues.join(" ")}`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: supabaseUrl
      ? [new URL("/storage/v1/object/public/product-images/**", supabaseUrl)]
      : [],
  },
  async redirects() {
    return [
      { source: "/combos", destination: "/jogos", permanent: true },
      { source: "/combo/:slug", destination: "/jogos", permanent: true },
      { source: "/admin/combos/:path*", destination: "/admin", permanent: true },
      { source: "/admin/campanhas/:path*", destination: "/admin", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
