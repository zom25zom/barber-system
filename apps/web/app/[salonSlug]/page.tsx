import { requireSalonPage } from "@/lib/salon-ssr";
import SalonSlugProvider from "@/components/SalonSlugProvider";
import SalonUnavailable from "@/components/pages/SalonUnavailable";
import HomeClient from "@/components/pages/HomeClient";

// SSR: rendered on-demand per request — new salons work instantly, no re-deploy.
export default async function Page({ params }: { params: Promise<{ salonSlug: string }> }) {
  const { salonSlug } = await params;
  // SSR tenant validation: unknown slugs get a real 404 (never salon-1 fallback).
  // Expired salon (subscription_status = 'expired') → unavailable screen instead
  // of normal content; booking APIs are blocked server-side independently.
  const state = await requireSalonPage(salonSlug);
  if (state.expired) return <SalonUnavailable />;
  return (
    <SalonSlugProvider salonSlug={salonSlug}>
      <HomeClient salonSlug={salonSlug} />
    </SalonSlugProvider>
  );
}
