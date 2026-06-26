import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import { addresses } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const addressId = parseInt(id);
    if (isNaN(addressId)) {
      return NextResponse.json(
        { error: "ID de dirección inválido" },
        { status: 400 }
      );
    }

    // Verificar que la dirección pertenece al usuario
    const existingAddress = await db
      .select()
      .from(addresses)
      .where(
        and(
          eq(addresses.id, addressId),
          eq(addresses.userId, parseInt(session.user.id))
        )
      )
      .limit(1);

    if (existingAddress.length === 0) {
      return NextResponse.json(
        { error: "Dirección no encontrada" },
        { status: 404 }
      );
    }

    // Quitar el flag isDefault de todas las direcciones del usuario
    await db
      .update(addresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(addresses.userId, parseInt(session.user.id)));

    // Marcar la dirección seleccionada como predeterminada
    const updatedAddress = await db
      .update(addresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(addresses.id, addressId),
          eq(addresses.userId, parseInt(session.user.id))
        )
      )
      .returning();

    return NextResponse.json(updatedAddress[0]);
  } catch (error) {
    console.error("Error setting default address:", error);
    return NextResponse.json(
      { error: "Error al marcar dirección como predeterminada" },
      { status: 500 }
    );
  }
}
