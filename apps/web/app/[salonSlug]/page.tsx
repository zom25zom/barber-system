import SalonSlugProvider from "@/components/SalonSlugProvider";
import HomeClient from "@/components/pages/HomeClient";

// SSR: rendered on-demand per request — new salons work instantly, no re-deploy.
export default async function Page({ params }: { params: Promise<{ salonSlug: string }> }) {
  const { salonSlug } = await params;
  return (
    <SalonSlugProvider salonSlug={salonSlug}>
      <HomeClient salonSlug={salonSlug} />
    </SalonSlugProvider>
  );
}
