import { auth } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { tiendanubeStores } from "@/lib/schema";
import { eq } from "drizzle-orm";
import TiendanubeDashboard from "@/components/admin/TiendanubeDashboard";

export default async function TiendanubeDashboardPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/login");
  }

  // Obtener la primera tienda conectada (o podríamos permitir seleccionar)
  const store = await db.query.tiendanubeStores.findFirst({
    where: eq(tiendanubeStores.status, "connected"),
    orderBy: (tiendanubeStores, { desc }) => [desc(tiendanubeStores.installedAt)],
  });

  if (!store) {
    redirect("/admin/tiendanube?error=no_store_connected");
  }

  return (
    <div className="container mx-auto py-6">
      <TiendanubeDashboard storeId={store.storeId} />
    </div>
  );
}
