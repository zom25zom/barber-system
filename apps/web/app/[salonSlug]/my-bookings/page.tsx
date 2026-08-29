import { requireSalonPage } from "@/lib/salon-ssr";
import SalonSlugProvider from "@/components/SalonSlugProvider";
import MyBookingsClient from "@/components/pages/MyBookingsClient";

// SSR: rendered on-demand per request — new salons work instantly, no re-deploy.
export default async function Page({ params }: { params: Promise<{ salonSlug: string }> }) {
  const { salonSlug } = await params;
  // SSR tenant validation: unknown slugs get a real 404 (never salon-1 fallback)
  await requireSalonPage(salonSlug);
  return (
    <SalonSlugProvider salonSlug={salonSlug}>
      <MyBookingsClient salonSlug={salonSlug} />
    </SalonSlugProvider>
  );
}
