import SalonSlugProvider from "@/components/SalonSlugProvider";
import NotificationsClient from "@/components/pages/NotificationsClient";

// SSR: rendered on-demand per request — new salons work instantly, no re-deploy.
export default async function Page({ params }: { params: Promise<{ salonSlug: string }> }) {
  const { salonSlug } = await params;
  return (
    <SalonSlugProvider salonSlug={salonSlug}>
      <NotificationsClient salonSlug={salonSlug} />
    </SalonSlugProvider>
  );
}
