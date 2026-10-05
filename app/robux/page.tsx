import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import { getByRobuxRates } from "@/lib/byrobux";
import { cosmicRateFromSupplier } from "@/lib/robux-pricing";
import { getRobuxSettings } from "@/lib/robux-settings";
import RobuxCalculator from "./RobuxCalculator";

export const dynamic = "force-dynamic";

export default async function RobuxPage() {
  const settings = await getRobuxSettings();
  let cosmicK: number | null = null;
  let available = settings.enabled;
  let unavailableMessage = "";
  if (available) {
    try {
      const rate = await getByRobuxRates();
      if (rate.catalogMaintenance) {
        available = false;
        unavailableMessage =
          rate.maintenanceMessage ||
          "O fornecedor está em manutenção. Tente novamente mais tarde.";
      } else if (rate.robuxRateBrlPerThousand > settings.maxSupplierK) {
        available = false;
        unavailableMessage =
          "A cotação atual está acima do limite de segurança da Cosmic. As compras ficam pausadas até o preço melhorar.";
      } else {
        cosmicK = cosmicRateFromSupplier(
          Number(rate.robuxRateBrlPerThousand),
          settings,
        );
      }
    } catch {
      available = false;
      unavailableMessage =
        "A cotação de Robux está temporariamente indisponível.";
    }
  } else {
    unavailableMessage = "As compras de Robux estão pausadas no momento.";
  }

  return (
    <>
      <SiteHeader />
      <main id="conteudo-principal" tabIndex={-1} className="shell pb-16">
        <div className="catalog-page-head">
          <p className="eyebrow">ROBUX · ENTREGA VIA GAMEPASS</p>
          <h1 className="section-title">Compre a quantidade que quiser.</h1>
          <p className="section-description max-w-3xl">
            Digite os Robux, escolha entre Taxa paga ou Sem taxa paga e a
            Cosmic calcula o GamePass, quanto você recebe e o valor automaticamente.
          </p>
        </div>
        <RobuxCalculator
          initialCosmicK={cosmicK}
          available={available}
          unavailableMessage={unavailableMessage}
          tutorialUrl={settings.tutorialUrl}
          pendingDaysMin={settings.pendingDaysMin}
          pendingDaysMax={settings.pendingDaysMax}
        />
      </main>
      <SiteFooter />
    </>
  );
}
