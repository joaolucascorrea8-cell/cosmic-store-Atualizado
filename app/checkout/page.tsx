import { getStoreService, getRequestTime } from "@/lib/store-service-server";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import CheckoutContent from "./CheckoutContent";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const service = await getStoreService();
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <CheckoutContent service={service} serviceNow={await getRequestTime()} />
      <SiteFooter />
    </div>
  );
}
