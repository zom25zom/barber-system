import { requireSalonPage } from "@/lib/salon-ssr";
import SalonSlugProvider from "@/components/SalonSlugProvider";
import SalonUnavailable from "@/components/pages/SalonUnavailable";
import BookClient from "@/components/pages/BookClient";

// SSR: rendered on-demand per request — new salons work instantly, no re-deploy.
export default async function Page({ params }: { params: Promise<{ salonSlug: string }> }) {
  const { salonSlug } = await params;
  // SSR tenant validation: unknown slugs get a real 404 (never salon-1 fallback)
  const state = await requireSalonPage(salonSlug);
  if (state.expired) return <SalonUnavailable />;
  return (
    <SalonSlugProvider salonSlug={salonSlug}>
      <BookClient salonSlug={salonSlug} />
    </SalonSlugProvider>
  );
}
