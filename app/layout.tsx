import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/app/context/CartContext";
import FloatingChatServer from "@/app/components/FloatingChatServer";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: { default: "Cosmic Store | Produtos digitais para Roblox", template: "%s | Cosmic Store" },
  description: "Frutas permanentes, game passes e produtos digitais para seus jogos favoritos.",
  applicationName: "Cosmic Store",
  openGraph: { title: "Cosmic Store", description: "Produtos digitais, atendimento acompanhado e entrega rápida.", type: "website", locale: "pt_BR" },
  icons: {
    icon: [
      { url: "/images/branding/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/branding/cosmic-store-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/images/branding/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} h-full antialiased`}
    >
     <body id="conteudo-principal" className="min-h-dvh bg-[#08070b] text-white">
  <a href="#conteudo-principal" className="skip-link">Ir para o conteúdo</a>
  <CartProvider>
    {children}
    <FloatingChatServer />
  </CartProvider>
</body>
    </html>
  );
}
