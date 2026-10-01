import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Entrar ou criar conta",
  robots: { index: false, follow: false },
};
export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
