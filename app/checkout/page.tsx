import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import CheckoutContent from "./CheckoutContent";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return <div className="min-h-screen"><SiteHeader /><CheckoutContent /><SiteFooter /></div>;
}

