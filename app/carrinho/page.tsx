import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import CartContent from "./CartContent";

export const dynamic = "force-dynamic";

export default function CartPage() {
  return <div className="min-h-screen"><SiteHeader/><CartContent/><SiteFooter/></div>;
}
