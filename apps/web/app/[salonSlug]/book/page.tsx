import SalonSlugProvider from "@/components/SalonSlugProvider";
import BookClient from "@/components/pages/BookClient";

// SSR: rendered on-demand per request — new salons work instantly, no re-deploy.
export default async function Page({ params }: { params: Promise<{ salonSlug: string }> }) {
  const { salonSlug } = await params;
  return (
    <SalonSlugProvider salonSlug={salonSlug}>
      <BookClient salonSlug={salonSlug} />
    </SalonSlugProvider>
  );
}
